"""
AlphaArena Public API SDK (Python)

Python SDK for the AlphaArena Public API

Installation:
    pip install requests

Usage:
    from alphaarena_sdk import AlphaArenaClient
    
    client = AlphaArenaClient(
        api_key='aa_live_xxxxx',
        base_url='https://alphaarena-production.up.railway.app'
    )
    
    # Get account info
    account = client.account.get_info()
    
    # Run a backtest
    result = client.backtest.run(
        symbol='BTC/USDT',
        strategy='sma',
        capital=10000,
        start_time='2024-01-01T00:00:00Z',
        end_time='2024-12-31T23:59:59Z'
    )
"""

import json
from typing import Optional, Dict, List, Any
from dataclasses import dataclass
from enum import Enum
import requests


class AlphaArenaError(Exception):
    """AlphaArena API Error"""
    def __init__(self, message: str, code: Optional[str] = None, status_code: Optional[int] = None):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


class OrderSide(Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP_MARKET = "stop_market"
    STOP_LIMIT = "stop_limit"


class StrategyStatus(Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    STOPPED = "stopped"


@dataclass
class Strategy:
    id: str
    name: str
    symbol: str
    status: StrategyStatus
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@dataclass
class BacktestResult:
    total_return: float
    win_rate: float
    profit_factor: float
    max_drawdown: float
    sharpe_ratio: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    trades: List[Dict[str, Any]]
    equity: List[Dict[str, Any]]


@dataclass
class VirtualAccount:
    id: str
    user_id: str
    balance: float
    initial_capital: float
    frozen_balance: float
    total_realized_pnl: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    account_currency: str
    is_active: bool
    created_at: str
    updated_at: str


@dataclass
class VirtualOrder:
    id: str
    account_id: str
    symbol: str
    side: OrderSide
    order_type: OrderType
    quantity: float
    filled_quantity: float
    remaining_quantity: float
    price: Optional[float]
    stop_price: Optional[float]
    average_fill_price: Optional[float]
    status: str
    time_in_force: str
    created_at: str
    updated_at: str


@dataclass
class LeaderboardEntry:
    rank: int
    strategy_id: str
    strategy_name: str
    total_return: float
    win_rate: float
    profit_factor: float
    sharpe_ratio: float
    max_drawdown: float
    trade_count: int


class AlphaArenaClient:
    """
    AlphaArena Public API Client
    
    Args:
        api_key: Your API key (format: aa_live_xxx or aa_test_xxx)
        base_url: API base URL (default: production URL)
        timeout: Request timeout in seconds (default: 30)
    """
    
    def __init__(
        self,
        api_key: str,
        base_url: str = 'https://alphaarena-production.up.railway.app',
        timeout: int = 30
    ):
        self.api_key = api_key
        self.base_url = base_url
        self.timeout = timeout
        
        self.session = requests.Session()
        self.session.headers.update({
            'X-API-Key': self.api_key,
            'Content-Type': 'application/json',
        })
        
        # Initialize API modules
        self.strategies = StrategyAPI(self)
        self.backtest = BacktestAPI(self)
        self.account = AccountAPI(self)
        self.leaderboard = LeaderboardAPI(self)
    
    def _request(self, method: str, path: str, data: Optional[Dict] = None) -> Dict:
        """Make an API request"""
        url = f"{self.base_url}{path}"
        
        try:
            if method == 'GET':
                response = self.session.get(url, timeout=self.timeout)
            elif method == 'POST':
                response = self.session.post(url, json=data, timeout=self.timeout)
            elif method == 'PUT':
                response = self.session.put(url, json=data, timeout=self.timeout)
            elif method == 'DELETE':
                response = self.session.delete(url, timeout=self.timeout)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            result = response.json()
            
            if not response.ok:
                raise AlphaArenaError(
                    result.get('error', 'API request failed'),
                    result.get('code'),
                    response.status_code
                )
            
            return result
            
        except requests.exceptions.RequestException as e:
            raise AlphaArenaError(str(e))
    
    def get_info(self) -> Dict:
        """Get API information"""
        return self._request('GET', '/public/v1')
    
    def health_check(self) -> Dict:
        """Check API health"""
        response = requests.get(f"{self.base_url}/health", timeout=self.timeout)
        return response.json()


class StrategyAPI:
    """Strategy API"""
    
    def __init__(self, client: AlphaArenaClient):
        self.client = client
    
    def list(self, status: Optional[str] = None, limit: int = 50, offset: int = 0) -> Dict:
        """
        List all strategies
        
        Args:
            status: Filter by status (active, paused, stopped)
            limit: Max results to return
            offset: Offset for pagination
        """
        params = {'limit': limit, 'offset': offset}
        if status:
            params['status'] = status
        
        query = '&'.join(f"{k}={v}" for k, v in params.items())
        return self.client._request('GET', f"/public/v1/strategies?{query}")
    
    def get(self, strategy_id: str) -> Dict:
        """Get a specific strategy"""
        return self.client._request('GET', f"/public/v1/strategies/{strategy_id}")
    
    def create(self, name: str, symbol: str, description: Optional[str] = None, config: Optional[Dict] = None) -> Dict:
        """
        Create a new strategy
        
        Args:
            name: Strategy name
            symbol: Trading symbol (e.g., BTC/USDT)
            description: Strategy description
            config: Strategy configuration
        """
        data = {'name': name, 'symbol': symbol}
        if description:
            data['description'] = description
        if config:
            data['config'] = config
        
        return self.client._request('POST', '/public/v1/strategies', data)
    
    def update_status(self, strategy_id: str, status: str) -> Dict:
        """
        Update strategy status
        
        Args:
            strategy_id: Strategy ID
            status: New status (active, paused, stopped)
        """
        return self.client._request('PUT', f"/public/v1/strategies/{strategy_id}/status", {'status': status})


class BacktestAPI:
    """Backtest API"""
    
    def __init__(self, client: AlphaArenaClient):
        self.client = client
    
    def run(
        self,
        symbol: str,
        strategy: str,
        capital: float,
        start_time: str,
        end_time: str,
        params: Optional[Dict] = None
    ) -> Dict:
        """
        Run a backtest
        
        Args:
            symbol: Trading symbol (e.g., BTC/USDT)
            strategy: Strategy type (sma, rsi, macd, bollinger, atr)
            capital: Initial capital
            start_time: Start time (ISO 8601 format)
            end_time: End time (ISO 8601 format)
            params: Strategy-specific parameters
        """
        data = {
            'symbol': symbol,
            'strategy': strategy,
            'capital': capital,
            'startTime': start_time,
            'endTime': end_time,
        }
        if params:
            data['params'] = params
        
        return self.client._request('POST', '/public/v1/backtest/run', data)
    
    def list_strategies(self) -> Dict:
        """List available backtest strategies"""
        return self.client._request('GET', '/public/v1/backtest/strategies')
    
    def list_symbols(self) -> Dict:
        """List available trading symbols"""
        return self.client._request('GET', '/public/v1/backtest/symbols')


class AccountAPI:
    """Account API"""
    
    def __init__(self, client: AlphaArenaClient):
        self.client = client
    
    def get_info(self) -> Dict:
        """Get account information"""
        return self.client._request('GET', '/public/v1/account')
    
    def list_positions(self) -> Dict:
        """List account positions"""
        return self.client._request('GET', '/public/v1/account/positions')
    
    def list_orders(self, status: Optional[str] = None, symbol: Optional[str] = None, limit: int = 50) -> Dict:
        """
        List orders
        
        Args:
            status: Filter by status
            symbol: Filter by symbol
            limit: Max results
        """
        params = {'limit': limit}
        if status:
            params['status'] = status
        if symbol:
            params['symbol'] = symbol
        
        query = '&'.join(f"{k}={v}" for k, v in params.items())
        return self.client._request('GET', f"/public/v1/account/orders?{query}")
    
    def create_order(
        self,
        symbol: str,
        side: str,
        order_type: str,
        quantity: float,
        price: Optional[float] = None,
        stop_price: Optional[float] = None,
        time_in_force: str = 'GTC'
    ) -> Dict:
        """
        Create an order
        
        Args:
            symbol: Trading symbol
            side: Order side (buy, sell)
            order_type: Order type (market, limit, stop_market, stop_limit)
            quantity: Order quantity
            price: Limit price (for limit/stop_limit orders)
            stop_price: Stop price (for stop orders)
            time_in_force: Time in force (GTC, IOC, FOK, GTD)
        """
        data = {
            'symbol': symbol,
            'side': side,
            'order_type': order_type,
            'quantity': quantity,
            'time_in_force': time_in_force,
        }
        if price is not None:
            data['price'] = price
        if stop_price is not None:
            data['stop_price'] = stop_price
        
        return self.client._request('POST', '/public/v1/account/orders', data)
    
    def cancel_order(self, order_id: str) -> Dict:
        """Cancel an order"""
        return self.client._request('POST', f"/public/v1/account/orders/{order_id}/cancel")
    
    def list_trades(self, symbol: Optional[str] = None, side: Optional[str] = None, limit: int = 50) -> Dict:
        """
        List trade history
        
        Args:
            symbol: Filter by symbol
            side: Filter by side (buy, sell)
            limit: Max results
        """
        params = {'limit': limit}
        if symbol:
            params['symbol'] = symbol
        if side:
            params['side'] = side
        
        query = '&'.join(f"{k}={v}" for k, v in params.items())
        return self.client._request('GET', f"/public/v1/account/trades?{query}")


class LeaderboardAPI:
    """Leaderboard API"""
    
    def __init__(self, client: AlphaArenaClient):
        self.client = client
    
    def get(self, sort_by: str = 'roi', limit: int = 100) -> Dict:
        """
        Get leaderboard
        
        Args:
            sort_by: Sort criterion (roi, winRate, profitFactor, sharpeRatio)
            limit: Max results
        """
        return self.client._request('GET', f"/public/v1/leaderboard?sortBy={sort_by}&limit={limit}")


# Example usage
if __name__ == '__main__':
    # Initialize client
    client = AlphaArenaClient(
        api_key='aa_live_your_api_key_here',
        base_url='http://localhost:3001'  # For local development
    )
    
    # Check health
    print("Health check:", client.health_check())
    
    # Get API info
    print("API info:", client.get_info())
    
    # List backtest strategies
    strategies = client.backtest.list_strategies()
    print("Available strategies:", strategies)
    
    # Run a backtest
    result = client.backtest.run(
        symbol='BTC/USDT',
        strategy='sma',
        capital=10000,
        start_time='2024-01-01T00:00:00Z',
        end_time='2024-12-31T23:59:59Z'
    )
    print("Backtest result:", result)