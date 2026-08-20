// src/components/soc/IPIntelligence.js
import React from 'react';
import { Paper, Box, Typography, Avatar, Chip, Divider, Stack, alpha, Grid } from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import ComputerIcon from '@mui/icons-material/Computer';
import FlagIcon from '@mui/icons-material/Flag';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { colors } from '../../constants/theme';

const IPIntelligence = ({ ipData }) => {
  if (!ipData) return null;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        background: `linear-gradient(135deg, ${alpha(colors.teal.main, 0.1)} 0%, ${alpha(colors.teal.main, 0.05)} 100%)`,
        border: `1px solid ${alpha(colors.teal.main, 0.2)}`,
        borderRadius: 3,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <PublicIcon sx={{ color: colors.teal.main, fontSize: 20 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>IP Intelligence</Typography>
      </Box>

      <Grid container spacing={1.5}>
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: alpha(colors.teal.main, 0.2), color: colors.teal.main, width: 32, height: 32 }}>
              <ComputerIcon sx={{ fontSize: 18 }} />
            </Avatar>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>IP Address</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{ipData.ip || '203.55.77.99'}</Typography>
            </Box>
          </Box>
        </Grid>

        {ipData.geo && (
          <>
            <Grid item xs={6}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Country</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <FlagIcon sx={{ fontSize: 14, color: colors.teal.main }} />
                <Typography variant="body2">{ipData.geo.country || 'Australia'}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>City</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LocationOnIcon sx={{ fontSize: 14, color: colors.teal.main }} />
                <Typography variant="body2">{ipData.geo.city || 'Perth'}</Typography>
              </Box>
            </Grid>
          </>
        )}
      </Grid>

      {ipData.reputation && (
        <Box sx={{ mt: 1.5 }}>
          <Divider sx={{ my: 1.5, borderColor: alpha(colors.teal.main, 0.2) }} />
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>Reputation</Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            <Chip
              label={`M: ${ipData.reputation.malicious || 0}`}
              size="small"
              sx={{ bgcolor: alpha(colors.error.main, 0.1), color: colors.error.main, height: 20, fontSize: '0.65rem' }}
            />
            <Chip
              label={`S: ${ipData.reputation.suspicious || 0}`}
              size="small"
              sx={{ bgcolor: alpha(colors.warning.main, 0.1), color: colors.warning.main, height: 20, fontSize: '0.65rem' }}
            />
            <Chip
              label={`H: ${ipData.reputation.harmless || 0}`}
              size="small"
              sx={{ bgcolor: alpha(colors.success.main, 0.1), color: colors.success.main, height: 20, fontSize: '0.65rem' }}
            />
          </Stack>
        </Box>
      )}
    </Paper>
  );
};

export default IPIntelligence;