import React, { useState } from 'react';
import { Layout, Typography, Card, Table, Tag, Select, Space, DatePicker, Grid } from '@arco-design/web-react';
const { Row, Col } = Grid;
import {
  LineChart,
  Line,
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
import { useTrades } from '../hooks/useData';
import type { TableProps } from '@arco-design/web-react';
import type { Trade } from '../utils/api';

const { Header, Content } = Layout;
const { Title } = Typography;

const TradesPage: React.FC = () => {
  const [symbol, setSymbol] = useState<string | undefined>(undefined);
  const [side, setSide] = useState<'buy' | 'sell' | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);

  const { trades, loading } = useTrades({ symbol, side }, 100);

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

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header>
        <Title heading={2} style={{ color: 'white', margin: 0 }}>
          AlphaArena - Trades
        </Title>
      </Header>
      <Content style={{ padding: '24px' }}>
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
          </Space>
        </Card>

        {/* Charts */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
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
          <Col span={12}>
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
                  <Area type="monotone" dataKey="price" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} name="Price ($)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* Trade Table */}
        <Card title="Trade History">
          <Table
            columns={tradeColumns}
            dataSource={trades}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            size="small"
          />
        </Card>
      </Content>
    </Layout>
  );
};

export default TradesPage;
