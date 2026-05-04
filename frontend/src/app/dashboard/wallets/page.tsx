'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTenant } from '../TenantContext';
import api from '../../../lib/api';

interface Wallet {
  _id: string;
  userId: string;
  ownerName: string;
  balance: number;
  currency: string;
  isActive: boolean;
}

export default function WalletsPage() {
  const { selectedTenant } = useTenant();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWallets = async () => {
    if (!selectedTenant) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/wallets', {
        headers: { 'X-Tenant-ID': selectedTenant },
      });
      setWallets(res.data);
    } catch (err: any) {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      setError(err.response?.data?.message || 'Failed to fetch wallets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, [selectedTenant]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  const highestBalance = Math.max(...wallets.map((w) => w.balance), 0);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mb: 4,
          alignItems: 'center',
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Wallets
        </Typography>
        <IconButton
          onClick={fetchWallets}
          sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.1)' }}
        >
          <RefreshIcon />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {!error && wallets.length === 0 && (
        <Typography>No wallets found for this tenant.</Typography>
      )}

      <Grid container spacing={3}>
        {wallets.map((wallet) => {
          const isHighest =
            wallet.balance === highestBalance && wallet.balance > 0;
          return (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={wallet.userId}>
              <Card
                sx={{
                  bgcolor: '#1e293b',
                  color: 'white',
                  border: isHighest
                    ? '2px solid #fbbf24'
                    : '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 2,
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {wallet.ownerName}
                    </Typography>
                    <Chip
                      label={wallet.isActive ? 'ACTIVE' : 'INACTIVE'}
                      size="small"
                      color={wallet.isActive ? 'success' : 'default'}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ opacity: 0.7, mb: 3 }}>
                    ID: {wallet.userId}
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 'bold',
                      color: isHighest ? '#fbbf24' : 'white',
                    }}
                  >
                    {(wallet.balance / 100).toLocaleString('en-IN', {
                      style: 'currency',
                      currency: wallet.currency,
                    })}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
