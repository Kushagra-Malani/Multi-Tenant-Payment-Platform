'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useTenant } from '../TenantContext';
import api from '../../../lib/api';

interface Wallet {
  userId: string;
  ownerName: string;
  balance: number;
  currency: string;
}

export default function TransferPage() {
  const { selectedTenant } = useTenant();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loadingWallets, setLoadingWallets] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchWallets = async () => {
    if (!selectedTenant) return;
    setLoadingWallets(true);
    try {
      const res = await api.get('/wallets', {
        headers: { 'X-Tenant-ID': selectedTenant },
      });
      setWallets(res.data);
    } catch (err) {
      setErrorMsg('Failed to fetch wallets');
    } finally {
      setLoadingWallets(false);
    }
  };

  useEffect(() => {
    fetchWallets();
    // Reset form on tenant change
    setFromUserId('');
    setToUserId('');
    setAmount('');
    setDescription('');
    setSuccessMsg('');
    setErrorMsg('');
  }, [selectedTenant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    const amountInPaise = Math.round(parseFloat(amount) * 100);
    const fromWallet = wallets.find((w) => w.userId === fromUserId);

    if (!fromWallet) {
      setErrorMsg('Invalid source wallet');
      setSubmitting(false);
      return;
    }

    try {
      const res = await api.post(
        '/wallets/transfer',
        {
          fromUserId,
          toUserId,
          amount: amountInPaise,
          currency: fromWallet.currency,
          description,
        },
        {
          headers: { 'X-Tenant-ID': selectedTenant },
        },
      );

      const data = res.data;
      setSuccessMsg(
        `Transfer complete! ${data.fromWallet.ownerName}: ${(data.fromWallet.balance / 100).toLocaleString('en-IN', { style: 'currency', currency: data.fromWallet.currency })} → ${data.toWallet.ownerName}: ${(data.toWallet.balance / 100).toLocaleString('en-IN', { style: 'currency', currency: data.toWallet.currency })}`,
      );

      // Reset form
      setAmount('');
      setDescription('');

      // Re-fetch wallets to update dropdowns
      fetchWallets();
    } catch (err: any) {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      setErrorMsg(err.response?.data?.message || 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedFromWallet = wallets.find((w) => w.userId === fromUserId);
  const availableToWallets = wallets.filter((w) => w.userId !== fromUserId);

  return (
    <Box sx={{ maxWidth: 'sm', mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 4 }}>
        Transfer Funds
      </Typography>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMsg}
        </Alert>
      )}
      {errorMsg && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMsg}
        </Alert>
      )}

      <Paper sx={{ p: 4, bgcolor: '#1e293b', color: 'white', borderRadius: 2 }}>
        {loadingWallets ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <form onSubmit={handleSubmit}>
            <TextField
              select
              label="From"
              fullWidth
              required
              value={fromUserId}
              onChange={(e) => setFromUserId(e.target.value)}
              sx={{
                mb: 3,
                '& .MuiInputBase-root': {
                  color: 'white',
                  bgcolor: 'rgba(255,255,255,0.05)',
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
              }}
            >
              {wallets.map((w) => (
                <MenuItem key={w.userId} value={w.userId}>
                  {w.ownerName} —{' '}
                  {(w.balance / 100).toLocaleString('en-IN', {
                    style: 'currency',
                    currency: w.currency,
                  })}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="To"
              fullWidth
              required
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              disabled={!fromUserId}
              sx={{
                mb: 3,
                '& .MuiInputBase-root': {
                  color: 'white',
                  bgcolor: 'rgba(255,255,255,0.05)',
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
              }}
            >
              {availableToWallets.map((w) => (
                <MenuItem key={w.userId} value={w.userId}>
                  {w.ownerName} —{' '}
                  {(w.balance / 100).toLocaleString('en-IN', {
                    style: 'currency',
                    currency: w.currency,
                  })}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <TextField
                label="Amount"
                type="number"
                fullWidth
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
                sx={{
                  '& .MuiInputBase-root': {
                    color: 'white',
                    bgcolor: 'rgba(255,255,255,0.05)',
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                }}
              />
              <TextField
                label="Currency"
                value={selectedFromWallet?.currency || ''}
                disabled
                sx={{
                  width: '30%',
                  '& .MuiInputBase-root': {
                    color: 'rgba(255,255,255,0.5)',
                    bgcolor: 'rgba(255,255,255,0.02)',
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                }}
              />
            </Box>

            <TextField
              label="Description (Optional)"
              fullWidth
              multiline
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              sx={{
                mb: 4,
                '& .MuiInputBase-root': {
                  color: 'white',
                  bgcolor: 'rgba(255,255,255,0.05)',
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
              }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={submitting || !fromUserId || !toUserId || !amount}
              sx={{
                py: 1.5,
                bgcolor: '#6366f1',
                '&:hover': { bgcolor: '#4f46e5' },
              }}
            >
              {submitting ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Send Money'
              )}
            </Button>
          </form>
        )}
      </Paper>
    </Box>
  );
}
