import React from 'react';

export const ResponsiveContainer = ({ children }: any) => (
  <div data-testid="responsive-container">{children}</div>
);
export const AreaChart = ({ children }: any) => (
  <div data-testid="area-chart">{children}</div>
);
export const ComposedChart = ({ children }: any) => (
  <div data-testid="composed-chart">{children}</div>
);
export const BarChart = ({ children }: any) => (
  <div data-testid="bar-chart">{children}</div>
);
export const PieChart = ({ children }: any) => (
  <div data-testid="pie-chart">{children}</div>
);
export const ScatterChart = ({ children }: any) => (
  <div data-testid="scatter-chart">{children}</div>
);
export const Line = () => <div data-testid="line" />;
export const Area = () => <div data-testid="area" />;
export const Bar = () => <div data-testid="bar" />;
export const Pie = () => <div data-testid="pie" />;
export const Scatter = () => <div data-testid="scatter" />;
export const Cell = () => <div data-testid="cell" />;
export const XAxis = () => <div data-testid="x-axis" />;
export const YAxis = () => <div data-testid="y-axis" />;
export const ZAxis = () => <div data-testid="z-axis" />;
export const CartesianGrid = () => <div data-testid="cartesian-grid" />;
export const Tooltip = () => <div data-testid="tooltip" />;
export const Legend = () => <div data-testid="legend" />;
export const ReferenceLine = () => <div data-testid="reference-line" />;
