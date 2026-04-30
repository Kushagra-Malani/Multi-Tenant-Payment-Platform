'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Box, Container, Typography, Paper, Grid, TextField, 
  Button, MenuItem, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Snackbar, Alert,
  IconButton
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RateLimitBar from './components/RateLimitBar';

export default function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantSlug = searchParams.get('tenant') || '';

  const [payments, setPayments] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [status, setStatus] = useState('pending');
  
  const [rateLimit, setRateLimit] = useState({ limit: 0, remaining: 0 });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const fetchPayments = async () => {
    if (!tenantSlug) return;
    try {
      const res = await fetch('/api/payments', {
        headers: { 'X-Tenant-ID': tenantSlug }
      });
      
      const limit = parseInt(res.headers.get('X-RateLimit-Limit') || '0', 10);
      const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') || '0', 10);
      if (limit > 0) {
        setRateLimit({ limit, remaining });
      }

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error('Rate limit exceeded! Please wait.');
        }
        if (res.status === 401) {
          throw new Error('Unauthorized or inactive tenant.');
        }
        throw new Error('Failed to fetch payments');
      }

      const data = await res.json();
      setPayments(data);
    } catch (error: any) {
      setSnackbar({ open: true, message: error.message, severity: 'error' });
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [tenantSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantSlug
        },
        body: JSON.stringify({ amount: Number(amount), currency, status })
      });

      const limit = parseInt(res.headers.get('X-RateLimit-Limit') || '0', 10);
      const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') || '0', 10);
      if (limit > 0) {
        setRateLimit({ limit, remaining });
      }

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error('Rate limit exceeded! Please wait.');
        }
        if (res.status === 403) {
          throw new Error('Transaction limit exceeded for this tenant tier.');
        }
        throw new Error('Failed to create payment');
      }

      setSnackbar({ open: true, message: 'Payment created successfully!', severity: 'success' });
      setAmount('');
      fetchPayments();
    } catch (error: any) {
      setSnackbar({ open: true, message: error.message, severity: 'error' });
    }
  };

  if (!tenantSlug) {
    return <Typography sx={{ mt: 4 }} align="center">No tenant specified</Typography>;
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" alignItems="center" mb={4}>
        <IconButton onClick={() => router.push('/')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          {tenantSlug.toUpperCase()} Dashboard
        </Typography>
      </Box>

      <RateLimitBar limit={rateLimit.limit} remaining={rateLimit.remaining} />

      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Create New Payment
            </Typography>
            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                label="Amount"
                type="number"
                fullWidth
                margin="normal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <TextField
                select
                label="Currency"
                fullWidth
                margin="normal"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <MenuItem value="USD">USD</MenuItem>
                <MenuItem value="EUR">EUR</MenuItem>
                <MenuItem value="INR">INR</MenuItem>
              </TextField>
              <TextField
                select
                label="Status"
                fullWidth
                margin="normal"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
              </TextField>
              <Button 
                type="submit" 
                variant="contained" 
                color="primary" 
                fullWidth 
                sx={{ mt: 2 }}
              >
                Create Payment
              </Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>ID</strong></TableCell>
                  <TableCell><strong>Amount</strong></TableCell>
                  <TableCell><strong>Currency</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Created At</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">No payments found</TableCell>
                  </TableRow>
                ) : (
                  payments.map((p) => (
                    <TableRow key={p._id}>
                      <TableCell>{p._id.slice(-6)}</TableCell>
                      <TableCell>{p.amount}</TableCell>
                      <TableCell>{p.currency}</TableCell>
                      <TableCell>{p.status}</TableCell>
                      <TableCell>{new Date(p.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
