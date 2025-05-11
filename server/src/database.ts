import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Check if we should use in-memory storage based on env flag
const useInMemory = process.env.USE_IN_MEMORY === 'true';

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'stock_tracker',
};

// In-memory storage as a fallback
const inMemoryStorage = {
  watchlists: new Map<number, Set<string>>(),
  historicalData: new Map<string, Array<{
    price: number,
    change_amount: number,
    change_percent: number,
    timestamp: Date
  }>>()
};

// Create a connection pool
let pool: mysql.Pool | null = null;
let usingFallback = useInMemory;

// Initialize only if not using in-memory storage
if (!useInMemory) {
  try {
    pool = mysql.createPool(dbConfig);
    console.log('MySQL connection pool created');
  } catch (error) {
    console.error('Failed to create MySQL connection pool, using in-memory storage instead:', error);
    usingFallback = true;
  }
} else {
  console.log('Using in-memory storage instead of MySQL (configured by .env)');
}

// Initialize the database (create tables if they don't exist)
export const initDatabase = async () => {
  if (usingFallback) {
    console.log('Using in-memory storage instead of MySQL');
    return;
  }

  try {
    if (!pool) throw new Error('Database pool not initialized');
    
    // Create users table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create watchlist table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS watchlist (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_symbol (user_id, symbol)
      )
    `);

    // Create historical_data table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS historical_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        change_amount DECIMAL(10, 2) NOT NULL,
        change_percent DECIMAL(10, 2) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_symbol_timestamp (symbol, timestamp)
      )
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database tables, using in-memory storage instead:', error);
    usingFallback = true;
  }
};

// Get a user's watchlist
export const getUserWatchlist = async (userId: number) => {
  try {
    if (usingFallback) {
      const userWatchlist = inMemoryStorage.watchlists.get(userId) || new Set<string>();
      return Array.from(userWatchlist).map(symbol => ({ symbol }));
    }

    if (!pool) throw new Error('Database pool not initialized');
    
    const [rows] = await pool.execute(
      'SELECT symbol FROM watchlist WHERE user_id = ?',
      [userId]
    );
    return rows;
  } catch (error) {
    console.error('Failed to get user watchlist:', error);
    
    // Fallback to in-memory storage if MySQL fails
    usingFallback = true;
    const userWatchlist = inMemoryStorage.watchlists.get(userId) || new Set<string>();
    return Array.from(userWatchlist).map(symbol => ({ symbol }));
  }
};

// Add a stock to a user's watchlist
export const addToWatchlist = async (userId: number, symbol: string) => {
  try {
    if (usingFallback) {
      if (!inMemoryStorage.watchlists.has(userId)) {
        inMemoryStorage.watchlists.set(userId, new Set<string>());
      }
      inMemoryStorage.watchlists.get(userId)?.add(symbol);
      return { success: true };
    }

    if (!pool) throw new Error('Database pool not initialized');
    
    await pool.execute(
      'INSERT INTO watchlist (user_id, symbol) VALUES (?, ?)',
      [userId, symbol]
    );
    return { success: true };
  } catch (error) {
    console.error('Failed to add to watchlist:', error);
    
    // Fallback to in-memory storage if MySQL fails
    usingFallback = true;
    if (!inMemoryStorage.watchlists.has(userId)) {
      inMemoryStorage.watchlists.set(userId, new Set<string>());
    }
    inMemoryStorage.watchlists.get(userId)?.add(symbol);
    return { success: true };
  }
};

// Remove a stock from a user's watchlist
export const removeFromWatchlist = async (userId: number, symbol: string) => {
  try {
    if (usingFallback) {
      const userWatchlist = inMemoryStorage.watchlists.get(userId);
      if (userWatchlist) {
        userWatchlist.delete(symbol);
      }
      return { success: true };
    }

    if (!pool) throw new Error('Database pool not initialized');
    
    await pool.execute(
      'DELETE FROM watchlist WHERE user_id = ? AND symbol = ?',
      [userId, symbol]
    );
    return { success: true };
  } catch (error) {
    console.error('Failed to remove from watchlist:', error);
    
    // Fallback to in-memory storage if MySQL fails
    usingFallback = true;
    const userWatchlist = inMemoryStorage.watchlists.get(userId);
    if (userWatchlist) {
      userWatchlist.delete(symbol);
    }
    return { success: true };
  }
};

// Store historical stock data
export const storeHistoricalData = async (
  symbol: string,
  price: number,
  changeAmount: number,
  changePercent: number
) => {
  try {
    if (usingFallback) {
      if (!inMemoryStorage.historicalData.has(symbol)) {
        inMemoryStorage.historicalData.set(symbol, []);
      }
      inMemoryStorage.historicalData.get(symbol)?.push({
        price,
        change_amount: changeAmount,
        change_percent: changePercent,
        timestamp: new Date()
      });
      return { success: true };
    }

    if (!pool) throw new Error('Database pool not initialized');
    
    await pool.execute(
      'INSERT INTO historical_data (symbol, price, change_amount, change_percent) VALUES (?, ?, ?, ?)',
      [symbol, price, changeAmount, changePercent]
    );
    return { success: true };
  } catch (error) {
    console.error('Failed to store historical data:', error);
    
    // Fallback to in-memory storage if MySQL fails
    usingFallback = true;
    if (!inMemoryStorage.historicalData.has(symbol)) {
      inMemoryStorage.historicalData.set(symbol, []);
    }
    inMemoryStorage.historicalData.get(symbol)?.push({
      price,
      change_amount: changeAmount,
      change_percent: changePercent,
      timestamp: new Date()
    });
    return { success: true };
  }
};

// Get historical data for a stock
export const getHistoricalData = async (symbol: string, limit = 30) => {
  try {
    if (usingFallback) {
      const data = inMemoryStorage.historicalData.get(symbol) || [];
      return data.slice(-limit).map((item, index) => ({
        id: index + 1,
        symbol,
        price: item.price,
        change_amount: item.change_amount,
        change_percent: item.change_percent,
        timestamp: item.timestamp
      }));
    }

    if (!pool) throw new Error('Database pool not initialized');
    
    const [rows] = await pool.execute(
      'SELECT * FROM historical_data WHERE symbol = ? ORDER BY timestamp DESC LIMIT ?',
      [symbol, limit]
    );
    return rows;
  } catch (error) {
    console.error('Failed to get historical data:', error);
    
    // Fallback to in-memory storage if MySQL fails
    usingFallback = true;
    const data = inMemoryStorage.historicalData.get(symbol) || [];
    return data.slice(-limit).map((item, index) => ({
      id: index + 1,
      symbol,
      price: item.price,
      change_amount: item.change_amount,
      change_percent: item.change_percent,
      timestamp: item.timestamp
    }));
  }
};

export default pool; 