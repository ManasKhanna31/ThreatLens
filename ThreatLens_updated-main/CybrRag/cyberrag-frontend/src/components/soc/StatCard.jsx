// src/components/soc/StatCard.js
import React from 'react';
import { Paper, Box, Typography, Avatar, Chip, alpha } from '@mui/material';
import { motion } from 'framer-motion';

const StatCard = ({ title, value, icon: Icon, color, trend, subtitle }) => {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          background: `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, ${alpha(color, 0.05)} 100%)`,
          border: `1px solid ${alpha(color, 0.2)}`,
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${color}, ${alpha(color, 0.5)})`,
          },
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
            <Avatar sx={{ bgcolor: alpha(color, 0.2), color: color, width: 40, height: 40 }}>
              <Icon fontSize="small" />
            </Avatar>
            {trend && (
              <Chip
                label={trend}
                size="small"
                sx={{ bgcolor: alpha(color, 0.1), color: color, fontSize: '0.7rem', height: 20 }}
              />
            )}
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            {value}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" sx={{ color: alpha(color, 0.8), display: 'block', mt: 0.5, fontSize: '0.7rem' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Paper>
    </motion.div>
  );
};

export default StatCard;