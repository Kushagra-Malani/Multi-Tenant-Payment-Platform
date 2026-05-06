'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar,
  Alert,
  IconButton,
  Chip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import RateLimitBar from './components/RateLimitBar';
import api from '../../lib/api';

export default function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantSlug = searchParams.get('tenant') || '';

  const [payments, setPayments] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [walletId, setWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [status, setStatus] = useState('pending');
  const [user, setUser] = useState<any>(null);

  const [rateLimit, setRateLimit] = useState({ limit: 0, remaining: 0 });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  // Super Admin specific state
  const [tenants, setTenants] = useState<any[]>([]);
  const [newTenant, setNewTenant] = useState({
    slug: '',
    name: '',
    tier: 'starter',
  });
  const [selectedTenant, setSelectedTenant] = useState(tenantSlug);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    }
  }, []);

  const fetchTenants = async () => {
    try {
      const res = await api.get('/tenants', {
        headers: { 'X-Tenant-ID': 'platform' },
      });
      setTenants(res.data);
    } catch (error) {
      console.error('Failed to fetch tenants');
    }
  };

  const fetchWallets = async (targetTenant?: string) => {
    const slug = targetTenant || tenantSlug;
    if (!slug) return;
    try {
      const res = await api.get('/wallets', {
        headers: { 'X-Tenant-ID': slug },
      });
      setWallets(res.data);
    } catch (error) {
      console.error('Failed to fetch wallets:', error);
    }
  };

  const fetchPayments = async (targetTenant?: string) => {
    const slug = targetTenant || tenantSlug;
    if (!slug) return;
    try {
      const res = await api.get('/payments', {
        headers: { 'X-Tenant-ID': slug },
      });

      const limit = parseInt(res.headers['x-ratelimit-limit'] || '0', 10);
      const remaining = parseInt(
        res.headers['x-ratelimit-remaining'] || '0',
        10,
      );
      if (limit > 0) {
        setRateLimit({ limit, remaining });
      }

      setPayments(res.data);
    } catch (error: any) {
      let msg = 'Failed to fetch payments';
      if (error.response) {
        if (error.response.status === 429)
          msg = 'Rate limit exceeded! Please wait.';
        if (error.response.status === 401)
          msg = 'Unauthorized or inactive tenant.';
        if (error.response.status === 403)
          msg =
            'Cross-tenant access denied! You are not authorized for this tenant.';
      }
      setSnackbar({ open: true, message: msg, severity: 'error' });
    }
  };

  useEffect(() => {
    fetchPayments(selectedTenant);
    fetchWallets(selectedTenant);
    if (user?.role === 'SUPER_ADMIN') {
      fetchTenants();
    }
  }, [tenantSlug, user, selectedTenant]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this payment?'))
      return;

    try {
      await api.delete(`/payments/${id}`, {
        headers: { 'X-Tenant-ID': selectedTenant },
      });
      setSnackbar({
        open: true,
        message: 'Payment deleted successfully',
        severity: 'success',
      });
      fetchPayments(selectedTenant);
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: 'Failed to delete payment',
        severity: 'error',
      });
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/tenants', newTenant, {
        headers: { 'X-Tenant-ID': 'platform' },
      });
      setSnackbar({
        open: true,
        message: 'Tenant created successfully!',
        severity: 'success',
      });
      setNewTenant({ slug: '', name: '', tier: 'starter' });
      fetchTenants();
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to create tenant',
        severity: 'error',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post(
        '/payments',
        { amount: Number(amount) * 100, currency, status, walletId },
        { headers: { 'X-Tenant-ID': selectedTenant } },
      );

      const limit = parseInt(res.headers['x-ratelimit-limit'] || '0', 10);
      const remaining = parseInt(
        res.headers['x-ratelimit-remaining'] || '0',
        10,
      );
      if (limit > 0) {
        setRateLimit({ limit, remaining });
      }

      setSnackbar({
        open: true,
        message: 'Payment created successfully!',
        severity: 'success',
      });
      setAmount('');
      setWalletId('');
      fetchPayments(selectedTenant);
    } catch (error: any) {
      let msg = 'Failed to create payment';
      if (error.response) {
        if (error.response.status === 429)
          msg = 'Rate limit exceeded! Please wait.';
        if (error.response.status === 403)
          msg = 'Transaction limit exceeded or cross-tenant access denied.';
      }
      setSnackbar({ open: true, message: msg, severity: 'error' });
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await api.patch(
        `/payments/${id}`,
        { status: 'completed' },
        { headers: { 'X-Tenant-ID': selectedTenant } },
      );
      setSnackbar({
        open: true,
        message: 'Payment completed successfully!',
        severity: 'success',
      });
      fetchPayments(selectedTenant);
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: 'Failed to complete payment',
        severity: 'error',
      });
    }
  };

  if (!tenantSlug) {
    return (
      <Typography sx={{ mt: 4 }} align="center">
        No tenant specified
      </Typography>
    );
  }

  const isAdmin = user?.role === 'TENANT_ADMIN' || user?.role === 'SUPER_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: 'white',
        pb: 8,
      }}
    >
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Header Section */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            mb: 4,
            justifyContent: 'space-between',
            p: 3,
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              onClick={() => router.push('/')}
              sx={{ mr: 2, color: 'white' }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography
                variant="h4"
                component="h1"
                sx={{ fontWeight: 800, letterSpacing: -1 }}
              >
                {isSuperAdmin
                  ? 'PLATFORM CONTROL'
                  : `${tenantSlug.toUpperCase()} HUB`}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.6 }}>
                {isSuperAdmin
                  ? 'System-wide Administration'
                  : 'Isolated Institution Dashboard'}
              </Typography>
            </Box>
          </Box>

          {isSuperAdmin && (
            <Box sx={{ textAlign: 'right' }}>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mb: 0.5,
                  opacity: 0.5,
                  fontWeight: 'bold',
                }}
              >
                SWITCH TENANT VIEW
              </Typography>
              <TextField
                select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                variant="outlined"
                size="small"
                sx={{
                  minWidth: 240,
                  ...textFieldStyles,
                  '& .MuiOutlinedInput-root': {
                    ...textFieldStyles['& .MuiOutlinedInput-root'],
                    background: 'rgba(99, 102, 241, 0.1)',
                    borderRadius: 2,
                  },
                }}
              >
                {tenants.map((t) => (
                  <MenuItem key={t.slug} value={t.slug}>
                    {t.name} ({t.slug})
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          )}
        </Box>

        {!isSuperAdmin && (
          <RateLimitBar
            limit={rateLimit.limit}
            remaining={rateLimit.remaining}
          />
        )}

        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 4 }}>
            {isSuperAdmin && (
              <Paper sx={{ ...glassPaper, p: 3, mb: 4 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                  Register New Institution
                </Typography>
                <Box component="form" onSubmit={handleCreateTenant}>
                  <TextField
                    label="Tenant Name"
                    fullWidth
                    margin="dense"
                    required
                    value={newTenant.name}
                    onChange={(e) =>
                      setNewTenant({ ...newTenant, name: e.target.value })
                    }
                    sx={textFieldStyles}
                  />
                  <TextField
                    label="Tenant Slug"
                    fullWidth
                    margin="dense"
                    required
                    value={newTenant.slug}
                    onChange={(e) =>
                      setNewTenant({ ...newTenant, slug: e.target.value })
                    }
                    sx={textFieldStyles}
                  />
                  <TextField
                    select
                    label="Subscription Tier"
                    fullWidth
                    margin="dense"
                    value={newTenant.tier}
                    onChange={(e) =>
                      setNewTenant({ ...newTenant, tier: e.target.value })
                    }
                    sx={textFieldStyles}
                  >
                    <MenuItem value="starter">Starter</MenuItem>
                    <MenuItem value="professional">Professional</MenuItem>
                    <MenuItem value="enterprise">Enterprise</MenuItem>
                  </TextField>
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    sx={{
                      mt: 3,
                      py: 1.5,
                      fontWeight: 'bold',
                      background:
                        'linear-gradient(90deg, #a855f7 0%, #d946ef 100%)',
                    }}
                  >
                    Deploy New Tenant
                  </Button>
                </Box>
              </Paper>
            )}

            <Paper sx={{ ...glassPaper, p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                {isSuperAdmin
                  ? 'Direct Transaction Injection'
                  : 'Create New Payment'}
              </Typography>
              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  select
                  label="Destination Wallet (Customer)"
                  fullWidth
                  margin="normal"
                  required
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  sx={textFieldStyles}
                >
                  {wallets.map((w) => (
                    <MenuItem key={w.userId} value={w.userId}>
                      {w.ownerName} ({w.userId})
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Amount"
                  type="number"
                  fullWidth
                  margin="normal"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  sx={textFieldStyles}
                />
                <TextField
                  select
                  label="Currency"
                  fullWidth
                  margin="normal"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  sx={textFieldStyles}
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
                  sx={textFieldStyles}
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                </TextField>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  sx={{
                    mt: 3,
                    py: 1.5,
                    fontWeight: 'bold',
                    background:
                      'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)',
                  }}
                >
                  Process Payment
                </Button>
              </Box>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            <TableContainer component={Paper} sx={{ ...glassPaper }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={tableHeaderStyle}>
                      <strong>ID</strong>
                    </TableCell>
                    <TableCell sx={tableHeaderStyle}>
                      <strong>AMOUNT</strong>
                    </TableCell>
                    <TableCell sx={tableHeaderStyle}>
                      <strong>CURRENCY</strong>
                    </TableCell>
                    <TableCell sx={tableHeaderStyle}>
                      <strong>STATUS</strong>
                    </TableCell>
                    <TableCell sx={tableHeaderStyle}>
                      <strong>TIMESTAMP</strong>
                    </TableCell>
                    {isAdmin && (
                      <TableCell align="right" sx={tableHeaderStyle}>
                        <strong>ACTIONS</strong>
                      </TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={isAdmin ? 6 : 5}
                        align="center"
                        sx={{ color: 'rgba(255,255,255,0.5)', py: 8 }}
                      >
                        No transaction data available for this tenant.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((p) => (
                      <TableRow
                        key={p._id}
                        sx={{
                          '&:hover': { background: 'rgba(255,255,255,0.02)' },
                        }}
                      >
                        <TableCell sx={{ color: 'white', opacity: 0.8 }}>
                          {p._id.slice(-6).toUpperCase()}
                        </TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>
                          {(p.amount / 100).toLocaleString()}
                        </TableCell>
                        <TableCell sx={{ color: 'white', opacity: 0.8 }}>
                          {p.currency}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={p.status.toUpperCase()}
                            size="small"
                            sx={{
                              background:
                                p.status === 'completed'
                                  ? 'rgba(34, 197, 94, 0.2)'
                                  : 'rgba(249, 115, 22, 0.2)',
                              color:
                                p.status === 'completed'
                                  ? '#4ade80'
                                  : '#fb923c',
                              fontWeight: 'bold',
                              fontSize: '0.65rem',
                            }}
                          />
                        </TableCell>
                        <TableCell
                          sx={{
                            color: 'white',
                            opacity: 0.6,
                            fontSize: '0.8rem',
                          }}
                        >
                          {new Date(p.createdAt).toLocaleString()}
                        </TableCell>
                        {isAdmin && (
                          <TableCell align="right">
                            {p.status === 'pending' && (
                              <IconButton
                                size="small"
                                sx={{ color: '#4ade80', mr: 1 }}
                                onClick={() => handleComplete(p._id)}
                                title="Complete Payment"
                              >
                                <CheckCircleIcon />
                              </IconButton>
                            )}
                            <IconButton
                              size="small"
                              sx={{ color: '#ef4444' }}
                              onClick={() => handleDelete(p._id)}
                              title="Delete Payment"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        )}
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
          <Alert
            severity={snackbar.severity}
            sx={{ width: '100%', borderRadius: 2 }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
}

const textFieldStyles = {
  '& .MuiOutlinedInput-root': {
    color: 'white',
    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
    '&.Mui-focused fieldset': { borderColor: '#818cf8' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.4)' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#818cf8' },
  '& .MuiSelect-icon': { color: 'white' },
};

const glassPaper = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 4,
  color: 'white',
  overflow: 'hidden',
};

const tableHeaderStyle = {
  color: 'rgba(255, 255, 255, 0.4)',
  fontSize: '0.7rem',
  letterSpacing: '1px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
};
