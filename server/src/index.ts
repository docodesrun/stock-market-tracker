import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocket, WebSocketServer } from 'ws';
import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
import axios from 'axios';
import { initDatabase, storeHistoricalData, getHistoricalData, addToWatchlist, removeFromWatchlist, getUserWatchlist } from './database';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// MySQL Connection (optional)
let db: any = null;
const initDb = async () => {
  try {
    db = await createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'stock_tracker'
    });
    console.log('Connected to MySQL database');
  } catch (error) {
    console.warn('Warning: MySQL connection failed. Running without database.');
  }
};

app.use(cors());
app.use(express.json());

// Active subscriptions storage
const activeSubscriptions: Map<string, Set<WebSocket>> = new Map();

// Update WebSocket port to use a port less likely to be in use
const WS_PORT = parseInt(process.env.WS_PORT || '8891', 10);
const wss = new WebSocketServer({ port: WS_PORT });
console.log(`WebSocket server started on port ${WS_PORT}`);

wss.on('connection', (ws: WebSocket) => {
  console.log('New client connected');

  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received message:', data);

      if (data.type === 'SUBSCRIBE_STOCK') {
        const symbol = data.symbol.toUpperCase();
        console.log(`Client subscribed to ${symbol}`);

        // Add the subscription
        if (!activeSubscriptions.has(symbol)) {
          activeSubscriptions.set(symbol, new Set());
        }
        activeSubscriptions.get(symbol)?.add(ws);

        // Send initial data
        sendStockData(symbol, ws);
      } else if (data.type === 'UNSUBSCRIBE_STOCK') {
        const symbol = data.symbol.toUpperCase();
        console.log(`Client unsubscribed from ${symbol}`);

        // Remove the subscription
        if (activeSubscriptions.has(symbol)) {
          activeSubscriptions.get(symbol)?.delete(ws);
          if (activeSubscriptions.get(symbol)?.size === 0) {
            activeSubscriptions.delete(symbol);
          }
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    // Clean up subscriptions
    activeSubscriptions.forEach((clients, symbol) => {
      clients.delete(ws);
      if (clients.size === 0) {
        activeSubscriptions.delete(symbol);
      }
    });
  });
});

// Function to send stock data to a client
async function sendStockData(symbol: string, ws: WebSocket) {
  try {
    // Check if we have an API key
    if (!process.env.ALPHA_VANTAGE_API_KEY) {
      console.log(`WebSocket: No API key found. Returning mock data for ${symbol}`);
      sendMockStockData(symbol, ws);
      return;
    }
    
    // Use real API if key is available
    const response = await axios.get(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
    );
    
    // Check if we got a rate limit message or empty response
    if (response.data['Note'] || response.data['Information'] || !response.data['Global Quote']) {
      console.log(`API rate limit reached or invalid response. Using mock data for ${symbol}`);
      sendMockStockData(symbol, ws);
      return;
    }
    
    const quote = response.data['Global Quote'];
    if (quote) {
      const price = parseFloat(quote['05. price']);
      const change = parseFloat(quote['09. change']);
      const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
      
      // Store historical data
      await storeHistoricalData(symbol, price, change, changePercent);
      
      ws.send(JSON.stringify({
        type: 'STOCK_UPDATE',
        data: {
          symbol: quote['01. symbol'],
          price: price,
          change: change,
          changePercent: changePercent,
          timestamp: new Date().toISOString()
        }
      }));
    } else {
      // If no quote data, send mock data
      sendMockStockData(symbol, ws);
    }
  } catch (error) {
    console.error('Error fetching stock data:', error);
    sendMockStockData(symbol, ws);
  }
}

// Function to generate and send mock stock data
function sendMockStockData(symbol: string, ws: WebSocket) {
  // Use stock-specific "random" but consistent data based on symbol
  // This ensures the same stock always gets similar values
  const hash = symbol.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  // Use the hash to generate semi-random but consistent values
  const basePrice = 50 + Math.abs(hash % 950);
  
  // Use a timestamp that changes less frequently (every 5 minutes)
  // This prevents constant price fluctuations
  const timeSegment = Math.floor(Date.now() / (5 * 60 * 1000));
  
  // Daily fluctuation up to ±2%
  const fluctuation = (Math.sin(timeSegment) * 0.02);
  const price = basePrice * (1 + fluctuation);
  const change = basePrice * fluctuation;
  const changePercent = fluctuation * 100;
  
  // Store historical data
  storeHistoricalData(
    symbol,
    price,
    change,
    changePercent
  ).catch(err => console.error('Failed to store mock historical data:', err));
  
  ws.send(JSON.stringify({
    type: 'STOCK_UPDATE',
    data: {
      symbol: symbol,
      price: price,
      change: change,
      changePercent: changePercent,
      timestamp: new Date().toISOString()
    }
  }));
}

// Set up periodic updates for all active subscriptions
setInterval(() => {
  activeSubscriptions.forEach((clients, symbol) => {
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        sendStockData(symbol, client);
      }
    });
  });
}, 60000); // Update every minute

// Get stock data from Alpha Vantage
app.get('/api/stocks/:symbol', async (req, res) => {
  const { symbol } = req.params;
  
  try {
    console.log(`Fetching data for ${symbol} with API key: ${process.env.ALPHA_VANTAGE_API_KEY}`);
    
    // Check if we have an API key
    if (!process.env.ALPHA_VANTAGE_API_KEY) {
      // Return mock data if no API key is available
      console.log(`No API key found. Returning mock data for ${symbol}`);
      return sendMockApiResponse(res, symbol);
    }
    
    // Use real API if key is available
    const response = await axios.get(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
    );
    
    console.log('API response:', response.data);
    
    // Check if we got a rate limit message or empty response
    if (response.data['Note'] || response.data['Information'] || !response.data['Global Quote']) {
      console.log(`API rate limit reached or invalid response. Using mock data for ${symbol}`);
      return sendMockApiResponse(res, symbol);
    }
    
    return res.json(response.data);
  } catch (error) {
    console.error('Failed to fetch stock data:', error);
    return sendMockApiResponse(res, symbol);
  }
});

// Function to send a mock API response
function sendMockApiResponse(res: Response, symbol: string) {
  // Use stock-specific "random" but consistent data based on symbol
  const hash = symbol.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  // Use the hash to generate semi-random but consistent values
  const basePrice = 50 + Math.abs(hash % 950);
  
  // Use a timestamp that changes less frequently (every 5 minutes)
  // This prevents constant price fluctuations
  const timeSegment = Math.floor(Date.now() / (5 * 60 * 1000));
  
  // Daily fluctuation up to ±2%
  const fluctuation = (Math.sin(timeSegment) * 0.02);
  const price = basePrice * (1 + fluctuation);
  const change = price - basePrice;
  const changePercent = fluctuation * 100;
  
  return res.json({
    "Global Quote": {
      "01. symbol": symbol,
      "05. price": price.toFixed(2),
      "09. change": change.toFixed(2),
      "10. change percent": `${changePercent.toFixed(2)}%`
    }
  });
}

// Get historical data for a stock
app.get('/api/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
    
    const data = await getHistoricalData(symbol, limit);
    res.json(data);
  } catch (error) {
    console.error('Failed to get historical data:', error);
    res.status(500).json({ error: 'Failed to get historical data' });
  }
});

// Get user's watchlist (mock user ID for now)
app.get('/api/watchlist', async (req, res) => {
  try {
    // Mock user ID (in a real app, this would come from authentication)
    const userId = 1;
    const watchlist = await getUserWatchlist(userId);
    res.json(watchlist);
  } catch (error) {
    console.error('Failed to get watchlist:', error);
    res.status(500).json({ error: 'Failed to get watchlist' });
  }
});

// Add stock to watchlist
app.post('/api/watchlist', async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    // Mock user ID (in a real app, this would come from authentication)
    const userId = 1;
    const result = await addToWatchlist(userId, symbol);
    res.json(result);
  } catch (error) {
    console.error('Failed to add to watchlist:', error);
    res.status(500).json({ error: 'Failed to add to watchlist' });
  }
});

// Remove stock from watchlist
app.delete('/api/watchlist/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    // Mock user ID (in a real app, this would come from authentication)
    const userId = 1;
    const result = await removeFromWatchlist(userId, symbol);
    res.json(result);
  } catch (error) {
    console.error('Failed to remove from watchlist:', error);
    res.status(500).json({ error: 'Failed to remove from watchlist' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Initialize database connection and start server
initDb().then(() => {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}); 