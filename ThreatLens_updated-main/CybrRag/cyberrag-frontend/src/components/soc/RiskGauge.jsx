// src/components/soc/RiskGauge.js
import React from 'react';
import { Paper, Box, Typography, Chip, alpha } from '@mui/material';
import { Doughnut } from 'react-chartjs-2';
import SpeedIcon from '@mui/icons-material/Speed';
import { colors, getRiskColor } from '../../constants/theme';

// Register Chart.js components
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const RiskGauge = ({ score = 78, level = 'HIGH' }) => {
  const riskColor = getRiskColor(level);
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        background: `linear-gradient(135deg, ${alpha(riskColor.main, 0.1)} 0%, ${alpha(riskColor.main, 0.05)} 100%)`,
        border: `1px solid ${alpha(riskColor.main, 0.2)}`,
        borderRadius: 3,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SpeedIcon sx={{ color: riskColor.main, fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Risk Score</Typography>
        </Box>
        <Chip
          label={level}
          size="small"
          sx={{
            background: riskColor.gradient,
            color: 'white',
            fontWeight: 600,
            height: 24,
            fontSize: '0.75rem',
          }}
        />
      </Box>

      <Box sx={{ position: 'relative', height: 140, display: 'flex', justifyContent: 'center' }}>
        <Box sx={{ width: 140, height: 140 }}>
          <Doughnut
            data={{
              datasets: [{
                data: [score, 100 - score],
                backgroundColor: [riskColor.main, alpha(colors.text.disabled, 0.2)],
                borderWidth: 0,
              }]
            }}
            options={{
              cutout: '70%',
              plugins: { legend: { display: false }, tooltip: { enabled: false } },
              maintainAspectRatio: true,
            }}
          />
        </Box>
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: riskColor.main }}>
            {score}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default RiskGauge;