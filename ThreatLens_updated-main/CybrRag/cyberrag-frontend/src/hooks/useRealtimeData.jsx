// src/hooks/useRealtimeData.js
import { useState, useEffect } from 'react';
import websocketService from '../services/websocket';
import api from '../services/api';

export const useRealtimeData = () => {
  const [threats, setThreats] = useState([]);
  const [stats, setStats] = useState({
    activeThreats: 0,
    totalEvents: 0,
    mitreTechniques: 0,
    riskScore: 0,
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Connect to WebSocket
    websocketService.connect();

    // Subscribe to real-time updates
    websocketService.subscribe('threat', (threat) => {
      setThreats(prev => [threat, ...prev].slice(0, 10));
      setStats(prev => ({
        ...prev,
        activeThreats: prev.activeThreats + 1,
      }));
    });

    websocketService.subscribe('event', (event) => {
      setRecentEvents(prev => [event, ...prev].slice(0, 20));
      setStats(prev => ({
        ...prev,
        totalEvents: prev.totalEvents + 1,
      }));
    });

    websocketService.subscribe('risk', (risk) => {
      setStats(prev => ({
        ...prev,
        riskScore: risk.score,
      }));
    });

    // Fetch initial data
    const fetchInitialData = async () => {
      try {
        const [threatsRes, statsRes, eventsRes] = await Promise.all([
          api.get('/threats/recent').catch(() => ({ data: [] })),
          api.get('/stats').catch(() => ({ 
            data: { 
              activeThreats: 3, 
              totalEvents: 1247, 
              mitreTechniques: 12, 
              riskScore: 78.5 
            } 
          })),
          api.get('/events/recent').catch(() => ({ data: [] })),
        ]);

        setThreats(threatsRes.data);
        setStats(statsRes.data);
        setRecentEvents(eventsRes.data);
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
        // Set mock data for demo
        setStats({
          activeThreats: 3,
          totalEvents: 1247,
          mitreTechniques: 12,
          riskScore: 78.5,
        });
        setThreats([
          { id: 1, type: 'Suspicious PowerShell Execution', ip: '203.55.77.99', severity: 'HIGH', time: '2 min ago' },
          { id: 2, type: 'Brute Force Attack', ip: '45.155.205.233', severity: 'MEDIUM', time: '5 min ago' },
          { id: 3, type: 'Credential Dumping', ip: '8.8.8.8', severity: 'LOW', time: '10 min ago' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    return () => {
      websocketService.disconnect();
    };
  }, []);

  return { threats, stats, recentEvents, loading };
};