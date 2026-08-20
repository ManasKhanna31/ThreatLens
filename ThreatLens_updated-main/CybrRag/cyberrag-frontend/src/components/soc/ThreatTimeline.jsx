// src/components/soc/ThreatTimeline.js
import React from 'react';
import { Paper, Box, Typography, Chip, alpha } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import TimelineIcon from '@mui/icons-material/Timeline';
import { colors } from '../../constants/theme';

const data = [
  { time: '00:00', value: 4 },
  { time: '04:00', value: 7 },
  { time: '08:00', value: 15 },
  { time: '12:00', value: 23 },
  { time: '16:00', value: 18 },
  { time: '20:00', value: 12 },
  { time: 'Now', value: 8 },
];

const ThreatTimeline = () => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        background: `linear-gradient(135deg, ${alpha(colors.purple.main, 0.1)} 0%, ${alpha(colors.purple.main, 0.05)} 100%)`,
        border: `1px solid ${alpha(colors.purple.main, 0.2)}`,
        borderRadius: 3,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TimelineIcon sx={{ color: colors.purple.main, fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Threat Timeline</Typography>
        </Box>
        <Chip label="24h" size="small" sx={{ bgcolor: alpha(colors.purple.main, 0.1), color: colors.purple.main, height: 20, fontSize: '0.7rem' }} />
      </Box>
      
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={alpha(colors.text.secondary, 0.1)} />
          <XAxis dataKey="time" stroke={colors.text.secondary} tick={{ fontSize: 8 }} />
          <YAxis stroke={colors.text.secondary} tick={{ fontSize: 8 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: colors.background.paper,
              border: `1px solid ${colors.purple.main}`,
              borderRadius: 6,
              fontSize: 10,
              padding: 4,
            }}
          />
          <Line type="monotone" dataKey="value" stroke={colors.purple.main} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Paper>
  );
};

export default ThreatTimeline;