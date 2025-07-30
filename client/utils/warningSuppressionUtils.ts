// Utility to suppress specific console warnings globally
export const suppressWarnings = () => {
  // Store original console methods
  const originalWarn = console.warn;
  const originalError = console.error;

  // Helper function to check if it's a Recharts component warning
  const isRechartsWarning = (args: any[]) => {
    const fullMessage = args.join(' ');
    const message = String(args[0] || '');
    const componentName = String(args[1] || '');

    // Check for defaultProps warnings
    const isDefaultPropsWarning = 
      message.includes('defaultProps') || 
      message.includes('Support for defaultProps will be removed') ||
      fullMessage.includes('defaultProps') ||
      fullMessage.includes('Support for defaultProps will be removed');

    // Check for Recharts components (including numbered variants like XAxis2, YAxis2)
    const rechartsComponents = [
      'XAxis', 'YAxis', 'XAxis2', 'YAxis2', 'BarChart', 'PieChart', 'AreaChart',
      'CartesianGrid', 'Tooltip', 'Legend', 'Line', 'Bar', 'Pie', 'Cell',
      'LineChart', 'ComposedChart', 'ScatterChart', 'RadarChart', 'TreeMap',
      'Sankey', 'FunnelChart', 'ResponsiveContainer'
    ];

    const isRechartsComponent = 
      rechartsComponents.some(comp => componentName === comp || componentName.includes(comp)) ||
      rechartsComponents.some(comp => fullMessage.includes(comp)) ||
      fullMessage.includes('recharts') ||
      message.includes('%s'); // React warning pattern

    return isDefaultPropsWarning && isRechartsComponent;
  };

  // Override console.warn
  console.warn = (...args: any[]) => {
    // Suppress Recharts defaultProps warnings
    if (isRechartsWarning(args)) {
      return; // Completely suppress
    }

    // Additional check for any XAxis/YAxis warnings
    const fullMessage = args.join(' ');
    if (fullMessage.includes('XAxis') || fullMessage.includes('YAxis')) {
      return;
    }

    // Show all other warnings normally
    originalWarn.apply(console, args);
  };

  // Override console.error with same logic
  console.error = (...args: any[]) => {
    // Suppress Recharts defaultProps errors
    if (isRechartsWarning(args)) {
      return; // Completely suppress
    }

    // Additional check for any XAxis/YAxis errors
    const fullMessage = args.join(' ');
    if (fullMessage.includes('XAxis') || fullMessage.includes('YAxis')) {
      return;
    }

    // Show all other errors normally
    originalError.apply(console, args);
  };

  // Return cleanup function
  return () => {
    console.warn = originalWarn;
    console.error = originalError;
  };
};
