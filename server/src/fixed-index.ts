import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import axios from 'axios';
import { initDatabase, getUserWatchlist, addToWatchlist, removeFromWatchlist, storeHistoricalData } from './database';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initDatabase()
  .then(() => console.log('Database initialized successfully'))
  .catch(err => console.error('Failed to initialize database:', err));

// Define port
const PORT = process.env.PORT || 3001;

// Initialize WebSocket server
const WS_PORT = parseInt(process.env.WS_PORT || '8891', 10);
const wss = new WebSocketServer({ port: WS_PORT });
console.log(`WebSocket server started on port ${WS_PORT}`);

// Store active connections
const clients = new Set<WebSocket>();
const subscriptions = new Map<string, Set<WebSocket>>();

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('New client connected');
  clients.add(ws);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'SUBSCRIBE_STOCK') {
        const stockSymbol = data.symbol.toUpperCase();
        if (!subscriptions.has(stockSymbol)) {
          subscriptions.set(stockSymbol, new Set<WebSocket>());
        }
        subscriptions.get(stockSymbol)?.add(ws);
        
        // Send initial data
        await sendStockData(stockSymbol, ws);
      } else if (data.type === 'UNSUBSCRIBE_STOCK') {
        const stockSymbol = data.symbol.toUpperCase();
        if (subscriptions.has(stockSymbol)) {
          subscriptions.get(stockSymbol)?.delete(ws);
        }
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
    
    // Remove from all subscriptions
    subscriptions.forEach((clients, symbol) => {
      clients.delete(ws);
    });
  });
});

// Function to send stock data through WebSocket
async function sendStockData(stockSymbol: string, ws: WebSocket) {
  try {
    // Check if we have an API key
    if (!process.env.ALPHA_VANTAGE_API_KEY) {
      console.log(`WebSocket: No API key found. Returning mock data for ${stockSymbol}`);
      sendMockStockData(stockSymbol, ws);
      return;
    }
    
    // Use real API if key is available
    const response = await axios.get(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${stockSymbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
    );
    
    // Check if we got a rate limit message or empty response
    if (response.data['Note'] || response.data['Information'] || !response.data['Global Quote']) {
      console.log(`API rate limit reached or invalid response. Using mock data for ${stockSymbol}`);
      sendMockStockData(stockSymbol, ws);
      return;
    }
    
    const quote = response.data['Global Quote'];
    if (quote) {
      const price = parseFloat(quote['05. price']);
      const change = parseFloat(quote['09. change']);
      const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
      
      // Store historical data
      await storeHistoricalData(stockSymbol, price, change, changePercent);
      
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
      sendMockStockData(stockSymbol, ws);
    }
  } catch (error) {
    console.error('Error fetching stock data:', error);
    sendMockStockData(stockSymbol, ws);
  }
}

// Function to generate and send mock stock data
function sendMockStockData(stockSymbol: string, ws: WebSocket) {
  // Use stock-specific "random" but consistent data based on symbol
  // This ensures the same stock always gets similar values
  const hash = stockSymbol.split('').reduce((a, b) => {
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
    stockSymbol,
    price,
    change,
    changePercent
  ).catch(err => console.error('Failed to store mock historical data:', err));
  
  ws.send(JSON.stringify({
    type: 'STOCK_UPDATE',
    data: {
      symbol: stockSymbol,
      price: price,
      change: change,
      changePercent: changePercent,
      timestamp: new Date().toISOString()
    }
  }));
}

// Periodically update all stock subscriptions
setInterval(() => {
  subscriptions.forEach((clients, symbol) => {
    if (clients.size > 0) {
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          sendStockData(symbol, client).catch(err => {
            console.error(`Error updating ${symbol}:`, err);
          });
        }
      });
    }
  });
}, 60000); // Update every minute

// API Routes

// Get stock data from Alpha Vantage
app.get('/api/stocks/:stockSymbol', async (req: Request, res: Response) => {
  const { stockSymbol } = req.params;
  
  try {
    console.log(`Fetching data for ${stockSymbol} with API key: ${process.env.ALPHA_VANTAGE_API_KEY}`);
    
    // Check if we have an API key
    if (!process.env.ALPHA_VANTAGE_API_KEY) {
      // Return mock data if no API key is available
      console.log(`No API key found. Returning mock data for ${stockSymbol}`);
      return sendMockApiResponse(res, stockSymbol);
    }
    
    // Use real API if key is available
    const response = await axios.get(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${stockSymbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
    );
    
    console.log('API response:', response.data);
    
    // Check if we got a rate limit message or empty response
    if (response.data['Note'] || response.data['Information'] || !response.data['Global Quote']) {
      console.log(`API rate limit reached or invalid response. Using mock data for ${stockSymbol}`);
      return sendMockApiResponse(res, stockSymbol);
    }
    
    return res.json(response.data);
  } catch (error) {
    console.error('Failed to fetch stock data:', error);
    return sendMockApiResponse(res, stockSymbol);
  }
});

// Function to send a mock API response
function sendMockApiResponse(res: Response, stockSymbol: string) {
  // Use stock-specific "random" but consistent data based on symbol
  const hash = stockSymbol.split('').reduce((a, b) => {
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
      "01. symbol": stockSymbol,
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
    const history = await storeHistoricalData(symbol, 0, 0, 0); // Just a placeholder to get history
    res.json(history);
  } catch (error) {
    console.error('Failed to get historical data:', error);
    res.status(500).json({ error: 'Failed to get historical data' });
  }
});

// Get user's watchlist
app.get('/api/watchlist', async (req, res) => {
  try {
    // Using a default user ID (1) since we don't have authentication
    const userId = 1;
    const watchlist = await getUserWatchlist(userId);
    res.json(watchlist);
  } catch (error) {
    console.error('Failed to get watchlist:', error);
    res.status(500).json({ error: 'Failed to get watchlist' });
  }
});

// Add a stock to watchlist
app.post('/api/watchlist', async (req, res) => {
  try {
    const { symbol } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    // Using a default user ID (1) since we don't have authentication
    const userId = 1;
    const result = await addToWatchlist(userId, symbol.toUpperCase());
    res.json(result);
  } catch (error) {
    console.error('Failed to add to watchlist:', error);
    res.status(500).json({ error: 'Failed to add to watchlist' });
  }
});

// Remove a stock from watchlist
app.delete('/api/watchlist/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    // Using a default user ID (1) since we don't have authentication
    const userId = 1;
    const result = await removeFromWatchlist(userId, symbol.toUpperCase());
    res.json(result);
  } catch (error) {
    console.error('Failed to remove from watchlist:', error);
    res.status(500).json({ error: 'Failed to remove from watchlist' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
}); 