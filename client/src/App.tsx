import React, { useState, useEffect, useRef } from 'react';
import './App.css';

interface StockData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp?: string;
}

interface WatchedStock {
  symbol: string;
  data: StockData | null;
}

function App() {
  const [symbol, setSymbol] = useState('');
  const [watchedStocks, setWatchedStocks] = useState<WatchedStock[]>([]);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved watchlist on initial mount
  useEffect(() => {
    const loadWatchlist = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('http://localhost:3001/api/watchlist');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (Array.isArray(data)) {
          // Convert the watchlist data to our format
          const stocks: WatchedStock[] = data.map(item => ({
            symbol: item.symbol,
            data: null
          }));
          setWatchedStocks(stocks);
        }
      } catch (err) {
        console.error('Error loading watchlist:', err);
        setError('Failed to load saved watchlist');
      } finally {
        setIsLoading(false);
      }
    };

    loadWatchlist();
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const websocket = new WebSocket('ws://localhost:8891');
        
        websocket.onopen = () => {
          console.log('Connected to WebSocket');
          setConnectionStatus('Connected');
          setIsConnected(true);
          setError(''); // Clear any previous connection errors
          
          // Re-subscribe to all currently watched stocks
          watchedStocks.forEach(stock => {
            websocket.send(JSON.stringify({ 
              type: 'SUBSCRIBE_STOCK', 
              symbol: stock.symbol 
            }));
          });
        };

        websocket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('Received WebSocket message:', message);

            if (message.type === 'STOCK_UPDATE') {
              const stockData = message.data;
              
              setWatchedStocks(prev => prev.map(stock => 
                stock.symbol === stockData.symbol 
                  ? { ...stock, data: stockData } 
                  : stock
              ));
            } else if (message.type === 'ERROR') {
              console.error('WebSocket error:', message.message);
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };

        websocket.onerror = (err) => {
          console.error('WebSocket error:', err);
          setConnectionStatus('Error');
          setError('Failed to connect to WebSocket server');
          setIsConnected(false);
        };

        websocket.onclose = () => {
          console.log('WebSocket connection closed');
          setConnectionStatus('Disconnected');
          setIsConnected(false);
          
          // Try to reconnect after 5 seconds
          setTimeout(() => {
            connectWebSocket();
          }, 5000);
        };

        wsRef.current = websocket;
        return websocket;
      } catch (err) {
        console.error('Error creating WebSocket:', err);
        setConnectionStatus('Error');
        setError('Failed to create WebSocket connection');
        return null;
      }
    };

    const ws = connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [watchedStocks]);

  // Function to save a stock to the watchlist API
  const saveToWatchlist = async (stockSymbol: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/watchlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbol: stockSymbol }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Stock saved to watchlist:', data);
      return true;
    } catch (err) {
      console.error('Error saving to watchlist:', err);
      return false;
    }
  };

  // Function to remove a stock from the watchlist API
  const removeFromWatchlist = async (stockSymbol: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/watchlist/${stockSymbol}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Stock removed from watchlist:', data);
      return true;
    } catch (err) {
      console.error('Error removing from watchlist:', err);
      return false;
    }
  };

  // Function to handle adding a stock to the watch list
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol) return;
    
    const upperSymbol = symbol.toUpperCase();

    // Check if stock is already being watched
    if (watchedStocks.some(stock => stock.symbol === upperSymbol)) {
      setError(`${upperSymbol} is already in your watch list`);
      return;
    }

    try {
      setError('');
      setIsLoading(true);
      console.log(`Fetching stock data for: ${upperSymbol}`);
      const response = await fetch(`http://localhost:3001/api/stocks/${upperSymbol}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Received data:', data);
      
      if (data['Global Quote']) {
        const quote = data['Global Quote'];
        const stockData: StockData = {
          symbol: quote['01. symbol'],
          price: parseFloat(quote['05. price']),
          change: parseFloat(quote['09. change']),
          changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
          timestamp: new Date().toISOString()
        };

        // Add stock to watch list
        setWatchedStocks(prev => [...prev, { symbol: stockData.symbol, data: stockData }]);
        
        // Subscribe to updates via WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ 
            type: 'SUBSCRIBE_STOCK', 
            symbol: stockData.symbol 
          }));
        } else {
          console.log('WebSocket not connected, will subscribe on reconnection');
        }

        // Save to watchlist API
        await saveToWatchlist(stockData.symbol);

        // Clear input field
        setSymbol('');
      } else {
        setError('Could not find stock data');
      }
    } catch (err) {
      console.error('Error fetching stock data:', err);
      setError('Failed to fetch stock data');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to remove a stock from the watch list
  const removeStock = async (stockSymbol: string) => {
    try {
      setIsLoading(true);
      
      // Remove from local state
      setWatchedStocks(prev => prev.filter(stock => stock.symbol !== stockSymbol));
      
      // Unsubscribe from updates via WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ 
          type: 'UNSUBSCRIBE_STOCK', 
          symbol: stockSymbol 
        }));
      }
      
      // Remove from watchlist API
      await removeFromWatchlist(stockSymbol);
      
    } catch (err) {
      console.error('Error removing stock:', err);
      setError('Failed to remove stock from watchlist');
    } finally {
      setIsLoading(false);
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Stock Market Price Tracker</h1>
        <div className="connection-status">
          Status: <span className={isConnected ? 'connected' : 'disconnected'}>
            {connectionStatus}
          </span>
        </div>
        
        <form onSubmit={handleSubmit} className="stock-form">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="Enter stock symbol (e.g., AAPL)"
            required
            className="stock-input"
            disabled={isLoading}
          />
          <button type="submit" className="stock-button" disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Track Stock'}
          </button>
        </form>
        
        {error && <p className="error">{error}</p>}
        
        <div className="stocks-container">
          {watchedStocks.length === 0 ? (
            <p className="no-stocks">
              {isLoading ? 'Loading watchlist...' : 'No stocks in your watch list. Add a stock to get started.'}
            </p>
          ) : (
            watchedStocks.map(stock => (
              <div key={stock.symbol} className="stock-card">
                <button 
                  className="remove-button" 
                  onClick={() => removeStock(stock.symbol)}
                  disabled={isLoading}
                >
                  ✕
                </button>
                
                <h2>{stock.symbol}</h2>
                
                {stock.data ? (
                  <>
                    <p className="price">Price: ${stock.data.price.toFixed(2)}</p>
                    <p className={stock.data.change >= 0 ? 'positive' : 'negative'}>
                      Change: ${stock.data.change.toFixed(2)} ({stock.data.changePercent.toFixed(2)}%)
                    </p>
                    <p className="timestamp">
                      Last Updated: {formatTimestamp(stock.data.timestamp)}
                    </p>
                  </>
                ) : (
                  <p>Loading data...</p>
                )}
              </div>
            ))
          )}
        </div>
      </header>
    </div>
  );
}

export default App; 