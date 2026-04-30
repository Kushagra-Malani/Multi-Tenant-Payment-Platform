'use client';

import { Box, LinearProgress, Typography } from '@mui/material';

interface RateLimitBarProps {
  limit: number;
  remaining: number;
}

export default function RateLimitBar({ limit, remaining }: RateLimitBarProps) {
  if (limit === 0) return null; // Hide if no data yet

  const used = limit - remaining;
  const percentage = (used / limit) * 100;

  let color: 'success' | 'warning' | 'error' = 'success';
  if (percentage >= 80) {
    color = 'error';
  } else if (percentage >= 50) {
    color = 'warning';
  }

  return (
    <Box sx={{ width: '100%', mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          API Calls (This Minute)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>{used}</strong> / {limit}
        </Typography>
      </Box>
      <LinearProgress 
        variant="determinate" 
        value={Math.min(percentage, 100)} 
        color={color}
        sx={{ height: 10, borderRadius: 5 }}
      />
    </Box>
  );
}
