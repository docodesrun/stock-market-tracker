import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import { expect } from 'chai';

describe('Stock Market Tracker E2E Tests', function() {
  let driver: WebDriver;

  before(async function() {
    driver = await new Builder().forBrowser('chrome').build();
  });

  after(async function() {
    await driver.quit();
  });

  it('should load the application', async function() {
    await driver.get('http://localhost:3000');
    const title = await driver.findElement(By.css('h1')).getText();
    expect(title).to.equal('Stock Market Tracker');
  });

  it('should search for a stock and display its data', async function() {
    await driver.get('http://localhost:3000');
    
    // Find and fill the input
    const input = await driver.findElement(By.css('input'));
    await input.sendKeys('AAPL');
    
    // Click the search button
    const button = await driver.findElement(By.css('button'));
    await button.click();
    
    // Wait for stock card to appear
    await driver.wait(until.elementLocated(By.css('.stock-card')), 5000);
    
    // Verify stock data is displayed
    const stockSymbol = await driver.findElement(By.css('h2')).getText();
    expect(stockSymbol).to.equal('AAPL');
    
    // Verify price is displayed
    const priceElement = await driver.findElement(By.css('p'));
    const priceText = await priceElement.getText();
    expect(priceText).to.include('Price: $');
  });

  it('should update stock prices in real-time', async function() {
    await driver.get('http://localhost:3000');
    
    // Search for a stock
    const input = await driver.findElement(By.css('input'));
    await input.sendKeys('AAPL');
    const button = await driver.findElement(By.css('button'));
    await button.click();
    
    // Wait for initial price
    await driver.wait(until.elementLocated(By.css('.stock-card')), 5000);
    const initialPrice = await driver.findElement(By.css('p')).getText();
    
    // Wait for price update (assuming updates every 5 seconds)
    await driver.sleep(5000);
    const updatedPrice = await driver.findElement(By.css('p')).getText();
    
    expect(updatedPrice).to.not.equal(initialPrice);
  });

  it('should handle multiple stock subscriptions', async function() {
    await driver.get('http://localhost:3000');
    
    // Add first stock
    let input = await driver.findElement(By.css('input'));
    await input.sendKeys('AAPL');
    let button = await driver.findElement(By.css('button'));
    await button.click();
    
    // Wait for first stock card
    await driver.wait(until.elementLocated(By.css('.stock-card')), 5000);
    
    // Add second stock
    input = await driver.findElement(By.css('input'));
    await input.clear();
    await input.sendKeys('MSFT');
    button = await driver.findElement(By.css('button'));
    await button.click();
    
    // Wait for second stock card
    await driver.wait(until.elementsLocated(By.css('.stock-card')), 5000);
    
    // Verify both stocks are displayed
    const stockCards = await driver.findElements(By.css('.stock-card'));
    expect(stockCards.length).to.equal(2);
  });
}); 