'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useTenant } from '../TenantContext';
import api from '../../../lib/api';

interface Wallet {
  userId: string;
  ownerName: string;
  balance: number;
}

interface LedgerEntry {
  status: string;
  amount: number;
}

export default function SettlementPage() {
  const { selectedTenant } = useTenant();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedTenant) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = { 'X-Tenant-ID': selectedTenant };
        const [walletsRes, ledgerRes] = await Promise.all([
          api.get('/wallets', { headers }),
          api.get('/wallets/ledger', { headers }),
        ]);
        setWallets(walletsRes.data);
        setLedger(ledgerRes.data);
      } catch (err) {
        console.error('Failed to fetch settlement data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedTenant]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const completedTransfers = ledger.filter((l) => l.status === 'COMPLETED');
  const totalVolume = completedTransfers.reduce((sum, l) => sum + l.amount, 0);

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 4 }}>
        Settlement Overview
      </Typography>

      <Grid container spacing={3} sx={{ mb: 5 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card
            sx={{
              bgcolor: '#1e293b',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <CardContent>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                Total System Balance
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {(totalBalance / 100).toLocaleString('en-IN', {
                  style: 'currency',
                  currency: 'INR',
                })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card
            sx={{
              bgcolor: '#1e293b',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <CardContent>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                Total Transfers
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {completedTransfers.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card
            sx={{
              bgcolor: '#1e293b',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <CardContent>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                Total Volume Moved
              </Typography>
              <Typography
                variant="h4"
                sx={{ fontWeight: 'bold', color: '#4ade80' }}
              >
                {(totalVolume / 100).toLocaleString('en-IN', {
                  style: 'currency',
                  currency: 'INR',
                })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
        User Balance Breakdown
      </Typography>
      <TableContainer
        component={Paper}
        sx={{ bgcolor: '#1e293b', borderRadius: 2, mb: 4 }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>
                User
              </TableCell>
              <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>
                Balance
              </TableCell>
              <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>
                Share of Total
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {wallets
              .sort((a, b) => b.balance - a.balance)
              .map((w) => {
                const share =
                  totalBalance > 0 ? (w.balance / totalBalance) * 100 : 0;
                return (
                  <TableRow
                    key={w.userId}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell sx={{ color: 'white' }}>
                      {w.ownerName}{' '}
                      <Typography
                        component="span"
                        variant="caption"
                        color="rgba(255,255,255,0.5)"
                      >
                        ({w.userId})
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>
                      {(w.balance / 100).toLocaleString('en-IN', {
                        style: 'currency',
                        currency: 'INR',
                      })}
                    </TableCell>
                    <TableCell sx={{ width: '40%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ width: '100%', mr: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={share}
                            sx={{
                              height: 8,
                              borderRadius: 4,
                              bgcolor: 'rgba(255,255,255,0.1)',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: '#6366f1',
                              },
                            }}
                          />
                        </Box>
                        <Box sx={{ minWidth: 35 }}>
                          <Typography variant="body2" color="white">
                            {share.toFixed(1)}%
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </TableContainer>

      <Alert
        severity="info"
        sx={{
          bgcolor: 'rgba(59, 130, 246, 0.1)',
          color: '#93c5fd',
          border: '1px solid rgba(59, 130, 246, 0.2)',
        }}
      >
        Inter-tenant settlement (Phase 2) coming soon. Cross-bank transfers will
        appear here.
      </Alert>
    </Box>
  );
}
