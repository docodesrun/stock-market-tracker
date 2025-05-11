# Stock Market Price Tracker

A real-time stock market price tracking application built with React, Node.js, Express, and WebSockets.

## Features

- **Real-time Stock Data**: Get instant updates on stock prices via WebSockets
- **Watchlist Functionality**: Save your favorite stocks to track
- **Mock Data Fallback**: Continue using the app even when API limits are reached
- **Responsive Design**: Works on desktop and mobile devices
- **In-Memory Storage**: No database configuration required for testing

## Tech Stack

- **Frontend**: React with TypeScript
- **Backend**: Node.js, Express
- **Real-time Communication**: WebSockets (ws library)
- **API Integration**: Alpha Vantage Stock API
- **Storage Options**: In-memory storage with MySQL fallback

## Setup and Installation

### Backend Setup

1. Navigate to the server directory:
   ```
   cd server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with the following contents:
   ```
   PORT=3001
   WS_PORT=8891
   ALPHA_VANTAGE_API_KEY=your_api_key
   USE_IN_MEMORY=true
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=stock_tracker
   ```

4. Start the server:
   ```
   npm run dev
   ```

### Frontend Setup

1. Navigate to the client directory:
   ```
   cd client
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the client:
   ```
   npm start
   ```

## Usage

1. Open your browser and go to `http://localhost:3000`
2. Enter a stock symbol (e.g., AAPL, MSFT, GOOGL) in the input field
3. Click "Track Stock" to add it to your watchlist
4. Watch real-time price updates for your tracked stocks
5. Remove stocks from your watchlist by clicking the "X" button

## API Limits

The application uses the Alpha Vantage API which has a limit of 25 requests per day on the free tier. Once this limit is reached, the application automatically switches to mock data to ensure continuous functionality.

## Future Enhancements

- User authentication
- Historical data charts
- Portfolio tracking
- Price alerts
- Social sharing features

## Developed By
Ahzam Khan  
Final Year Student

## Features
- Real-time stock price tracking
- Visual representation of stock price changes
- Historical data tracking
- WebSocket connection for live updates
- Integration with Alpha Vantage API

## Tech Stack
- **Frontend**: React, TypeScript, CSS
- **Backend**: Node.js, Express, TypeScript
- **Communication**: WebSockets (ws)
- **Data Source**: Alpha Vantage API
- **Database**: MySQL (optional)

## Installation

### Prerequisites
- Node.js
- npm
- MySQL (optional)

### Setup
1. Clone the repository:
```
git clone https://github.com/ahzamkhan/stock-market-tracker.git
cd stock-market-tracker
```

2. Install dependencies:
```
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

3. Configure environment variables:
Create a `.env` file in the server directory with the following content:
```
PORT=3001
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=stock_tracker
ALPHA_VANTAGE_API_KEY=your_api_key
```

4. Start the application:
```
# Start the server
cd server
npm run dev

# Start the client (in a new terminal)
cd client
npm start
```

## Usage
1. Open your browser and navigate to `http://localhost:3000`
2. Enter a stock symbol (e.g., AAPL, MSFT, GOOGL)
3. Click the "Track Stock" button to view real-time data

## License
MIT

## Acknowledgements
- [Alpha Vantage](https://www.alphavantage.co/) for providing the stock market data API
- React and TypeScript communities for excellent documentation

## Features

- Live stock price updates using WebSocket
- Interactive charts using Recharts
- MySQL database for transaction history
- End-to-end testing with Selenium
- Real-time API integration with Alpha Vantage

## Prerequisites

- Node.js (v14 or higher)
- MySQL (v8.0 or higher)
- Chrome WebDriver (for E2E tests)
- Alpha Vantage API key

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd stock-market-tracker
```

2. Install dependencies:
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install

# Install test dependencies
cd ../tests
npm install
```

3. Set up the database:
```bash
# Log into MySQL and run the initialization script
mysql -u root -p < server/db/init.sql
```

4. Configure environment variables:
- Create `.env` file in the server directory
- Add the following variables:
  ```
  PORT=3001
  DB_HOST=localhost
  DB_USER=root
  DB_PASSWORD=your_password
  DB_NAME=stock_tracker
  ALPHA_VANTAGE_API_KEY=your_api_key
  ```

5. Start the application:
```bash
# Start the backend server
cd server
npm start

# Start the frontend application
cd ../client
npm start
```

## Running Tests

### End-to-End Tests
```bash
cd tests
npm test
```

### API Tests
Use Postman to import the collection from `tests/postman_collection.json` and run the tests.

### Performance Tests
1. Install Apache JMeter
2. Open the test plan from `tests/jmeter/load_test.jmx`
3. Run the test plan

## Architecture

- Frontend: React with TypeScript
- Backend: Node.js with Express
- Database: MySQL
- Real-time updates: WebSocket
- Testing: Selenium WebDriver, Jest, JMeter

## API Documentation

### Stock Price Endpoint
```
GET /api/stocks/:symbol
```
Returns the current stock price and related information for the given symbol.

### Transaction Endpoint
```
POST /api/transactions
```
Stores a new stock transaction in the database.

## WebSocket Events

- `SUBSCRIBE_STOCK`: Subscribe to real-time updates for a stock
- `STOCK_UPDATE`: Receive real-time price updates

## Performance Considerations

- WebSocket connection for real-time updates
- Database indexing for quick transaction lookups
- Rate limiting for API calls
- Responsive UI design for various screen sizes

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request 