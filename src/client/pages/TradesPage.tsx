import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Card, Table, Tag, Select, Space, DatePicker, Grid, Button, Collapse } from '@arco-design/web-react';
const { Row, Col } = Grid;
const CollapseItem = Collapse.Item;
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { useTrades, useStrategies } from '../hooks/useData';
import { ErrorBoundary } from '../components/ErrorBoundary';
import ExportModal from '../components/ExportModal';
import MobileTableCard from '../components/MobileTableCard';
import type { TableProps } from '@arco-design/web-react';
import type { Trade } from '../utils/api';

const { Title } = Typography;

const TradesPage: React.FC = () => {
  const [symbol, setSymbol] = useState<string | undefined>(undefined);
  const [side, setSide] = useState<'buy' | 'sell' | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Memoize filters to prevent infinite re-renders
  const filters = useMemo(() => ({ symbol, side }), [symbol, side]);
  const { trades, loading } = useTrades(filters, 100);
  const { strategies } = useStrategies();

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Filter trades by date range if selected
  const filteredTrades = useMemo(() => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) return trades;
    const [start, end] = dateRange;
    return trades.filter(trade => {
      const tradeDate = new Date(trade.executedAt);
      return tradeDate >= start && tradeDate <= end;
    });
  }, [trades, dateRange]);

  // Get unique symbols from trades
  const availableSymbols = useMemo(() => {
    return Array.from(new Set(trades.map(t => t.symbol)));
  }, [trades]);

  // Get strategies for export filter
  const availableStrategies = useMemo(() => {
    return strategies.map(s => ({ id: s.id, name: s.name }));
  }, [strategies]);

  // Prepare chart data
  const tradeDistributionData = trades.reduce((acc: any, trade) => {
    const hour = new Date(trade.executedAt).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, '0')}:00`,
    trades: tradeDistributionData[i] || 0,
  }));

  const volumeBySymbolData = trades.reduce((acc: any, trade) => {
    acc[trade.symbol] = (acc[trade.symbol] || 0) + trade.total;
    return acc;
  }, {} as Record<string, number>);

  const symbolVolumeData = Object.entries(volumeBySymbolData).map(([symbol, volume]) => ({
    symbol,
    volume,
  }));

  const priceTrendData = trades
    .filter(t => !side || t.side === side)
    .sort((a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime())
    .map(trade => ({
      time: new Date(trade.executedAt).toLocaleTimeString(),
      price: trade.price,
      volume: trade.quantity,
    }));

  // Mobile card fields for trades
  const tradeCardFields = useMemo(() => [
    { 
      key: 'symbol', 
      label: 'Symbol', 
      priority: 'high' as const,
      type: 'text' as const,
    },
    { 
      key: 'side', 
      label: 'Side', 
      priority: 'high' as const,
      render: (v: 'buy' | 'sell') => (
        <Tag color={v === 'buy' ? 'green' : 'red'}>
          {v.toUpperCase()}
        </Tag>
      ),
    },
    { 
      key: 'price', 
      label: 'Price', 
      priority: 'medium' as const,
      render: (v: number) => `$${v.toLocaleString()}`,
    },
    { 
      key: 'quantity', 
      label: 'Qty', 
      priority: 'medium' as const,
      type: 'number' as const,
    },
    { 
      key: 'total', 
      label: 'Total', 
      priority: 'high' as const,
      render: (v: number) => `$${v.toLocaleString()}`,
    },
    { 
      key: 'executedAt', 
      label: 'Time', 
      priority: 'low' as const,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    { 
      key: 'fee', 
      label: 'Fee', 
      priority: 'low' as const,
      render: (v?: number) => v ? `$${v.toFixed(4)}` : '-',
    },
  ], []);

  // Trade table columns
  const tradeColumns: TableProps<Trade>['columns'] = [
    {
      title: 'Time',
      dataIndex: 'executedAt',
      key: 'executedAt',
      width: 120,
      render: (text: string) => new Date(text).toLocaleString(),
      sorter: (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
    },
    {
      title: 'Strategy ID',
      dataIndex: 'strategyId',
      key: 'strategyId',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
      filters: Array.from(new Set(trades.map(t => t.symbol))).map(s => ({ text: s, value: s })),
      onFilter: (value: any, record) => record.symbol === value,
    },
    {
      title: 'Side',
      dataIndex: 'side',
      key: 'side',
      width: 80,
      render: (side: 'buy' | 'sell') => (
        <Tag color={side === 'buy' ? 'green' : 'red'}>
          {side}
        </Tag>
      ),
      filters: [
        { text: 'Buy', value: 'buy' },
        { text: 'Sell', value: 'sell' },
      ],
      onFilter: (value: any, record) => record.side === value,
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (price: number) => `$${price.toLocaleString()}`,
      sorter: (a, b) => a.price - b.price,
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 100,
      render: (total: number) => `$${total.toLocaleString()}`,
      sorter: (a, b) => a.total - b.total,
    },
    {
      title: 'Fee',
      dataIndex: 'fee',
      key: 'fee',
      width: 80,
      render: (fee?: number) => fee ? `$${fee.toFixed(4)}` : '-',
    },
  ];

  // Mobile layout with cards
  if (isMobile) {
    return (
      <ErrorBoundary>
        <div className="trades-mobile">
          <Title heading={4} style={{ marginBottom: 12 }}>
            Trades
          </Title>

          {/* Filters - Collapsible on mobile */}
          <Card style={{ marginBottom: 12 }}>
            <Collapse accordion>
              <CollapseItem header="Filters" name="filters">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Select
                    placeholder="All Symbols"
                    style={{ width: '100%' }}
                    allowClear
                    value={symbol}
                    onChange={setSymbol}
                  >
                    {Array.from(new Set(trades.map(t => t.symbol))).map(s => (
                      <Select.Option key={s} value={s}>{s}</Select.Option>
                    ))}
                  </Select>
                  <Select
                    placeholder="All Sides"
                    style={{ width: '100%' }}
                    allowClear
                    value={side}
                    onChange={setSide}
                  >
                    <Select.Option value="buy">Buy</Select.Option>
                    <Select.Option value="sell">Sell</Select.Option>
                  </Select>
                  <DatePicker.RangePicker
                    value={dateRange}
                    onChange={(dates) => setDateRange(dates as [any, any] | null)}
                    style={{ width: '100%' }}
                  />
                  <Button 
                    type="primary" 
                    onClick={() => setShowExportModal(true)}
                    style={{ width: '100%' }}
                  >
                    Export
                  </Button>
                </Space>
              </CollapseItem>
            </Collapse>
          </Card>

          {/* Charts - Collapsible on mobile */}
          <Collapse accordion style={{ marginBottom: 12 }}>
            <CollapseItem header="Hourly Distribution" name="hourly">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="trades" fill="#8884d8" name="Trades" />
                </BarChart>
              </ResponsiveContainer>
            </CollapseItem>
            <CollapseItem header="Volume by Symbol" name="volume">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={symbolVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="symbol" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="volume" fill="#82ca9d" name="Volume ($)" />
                </BarChart>
              </ResponsiveContainer>
            </CollapseItem>
            <CollapseItem header="Price Trend" name="price">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={priceTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.3}
                    name="Price ($)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CollapseItem>
          </Collapse>

          {/* Trade Cards */}
          <Card title="Trade History" loading={loading}>
            {filteredTrades.length > 0 ? (
              filteredTrades.slice(0, 20).map((trade) => (
                <MobileTableCard
                  key={trade.id}
                  data={trade}
                  fields={tradeCardFields}
                  title={trade.symbol}
                />
              ))
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
                No trades found
              </div>
            )}
          </Card>

          {/* Export Modal */}
          <ExportModal
            visible={showExportModal}
            onCancel={() => setShowExportModal(false)}
            trades={filteredTrades}
            availableSymbols={availableSymbols}
            availableStrategies={availableStrategies}
          />
        </div>
      </ErrorBoundary>
    );
  }

  // Desktop layout
  return (
    <ErrorBoundary>
      <div>
        {/* Page Title */}
        <Title heading={3} style={{ marginBottom: 24 }}>
          Trades
        </Title>

        {/* Filters */}
        <Card style={{ marginBottom: 24 }}>
          <Space wrap>
            <Select
              placeholder="All Symbols"
              style={{ width: 150 }}
              allowClear
              value={symbol}
              onChange={setSymbol}
            >
              {Array.from(new Set(trades.map(t => t.symbol))).map(s => (
                <Select.Option key={s} value={s}>{s}</Select.Option>
              ))}
            </Select>
            <Select
              placeholder="All Sides"
              style={{ width: 120 }}
              allowClear
              value={side}
              onChange={setSide}
            >
              <Select.Option value="buy">Buy</Select.Option>
              <Select.Option value="sell">Sell</Select.Option>
            </Select>
            <DatePicker.RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [any, any] | null)}
            />
            <Button 
              type="primary" 
              onClick={() => setShowExportModal(true)}
            >
              Export
            </Button>
          </Space>
        </Card>

        {/* Charts */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <Card title="Hourly Trade Distribution">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="trades" fill="#8884d8" name="Trades" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="Volume by Symbol">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={symbolVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="symbol" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="volume" fill="#82ca9d" name="Volume ($)" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card title="Price Trend">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={priceTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.3}
                    name="Price ($)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* Trade Table - Scrollable on mobile */}
        <Card
          title="Trade History"
          bodyStyle={isMobile ? { padding: 0, overflowX: 'auto' } : undefined}
        >
          <div className={isMobile ? 'mobile-table-container' : ''}>
            <Table
              columns={tradeColumns}
              dataSource={filteredTrades}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              size="small"
              scroll={isMobile ? { x: 1000 } : undefined}
            />
          </div>
        </Card>

        {/* Export Modal */}
        <ExportModal
          visible={showExportModal}
          onCancel={() => setShowExportModal(false)}
          trades={filteredTrades}
          availableSymbols={availableSymbols}
          availableStrategies={availableStrategies}
        />
      </div>
    </ErrorBoundary>
  );
};

export default TradesPage;
