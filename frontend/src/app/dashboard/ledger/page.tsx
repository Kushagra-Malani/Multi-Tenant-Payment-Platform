'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import { useTenant } from '../TenantContext';
import api from '../../../lib/api';

interface Wallet {
  userId: string;
  ownerName: string;
}

interface LedgerEntry {
  _id: string;
  createdAt: string;
  type: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
}

export default function LedgerPage() {
  const { selectedTenant } = useTenant();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [selectedUser, setSelectedUser] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedTenant) return;

    const fetchInitialData = async () => {
      try {
        const walletsRes = await api.get('/wallets', {
          headers: { 'X-Tenant-ID': selectedTenant },
        });
        setWallets(walletsRes.data);
      } catch (err) {
        console.error('Failed to fetch wallets');
      }
    };

    fetchInitialData();
    setSelectedUser('ALL'); // reset filter on tenant change
  }, [selectedTenant]);

  useEffect(() => {
    if (!selectedTenant) return;

    const fetchLedger = async () => {
      setLoading(true);
      setError('');
      try {
        const endpoint =
          selectedUser === 'ALL'
            ? '/wallets/ledger'
            : `/wallets/ledger/${selectedUser}`;
        const res = await api.get(endpoint, {
          headers: { 'X-Tenant-ID': selectedTenant },
        });
        setLedger(res.data);
      } catch (err: any) {
        // eslint-disable-line @typescript-eslint/no-explicit-any
        setError(err.response?.data?.message || 'Failed to fetch ledger');
      } finally {
        setLoading(false);
      }
    };

    fetchLedger();
  }, [selectedTenant, selectedUser]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'FAILED':
        return 'error';
      default:
        return 'default';
    }
  };

  const getUserName = (userId: string) => {
    const w = wallets.find((w) => w.userId === userId);
    return w ? w.ownerName : userId;
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Ledger
        </Typography>

        <Select
          size="small"
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          sx={{
            minWidth: 200,
            bgcolor: '#1e293b',
            color: 'white',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(255,255,255,0.1)',
            },
            '& .MuiSvgIcon-root': { color: 'white' },
          }}
        >
          <MenuItem value="ALL">All Users</MenuItem>
          {wallets.map((w) => (
            <MenuItem key={w.userId} value={w.userId}>
              {w.ownerName}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TableContainer
        component={Paper}
        sx={{ bgcolor: '#1e293b', borderRadius: 2 }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
            <CircularProgress />
          </Box>
        ) : ledger.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', p: 4 }}>
            <Typography align="center" color="rgba(255,255,255,0.5)">
              No transactions found
            </Typography>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' }}
                >
                  Date
                </TableCell>
                <TableCell
                  sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' }}
                >
                  Type
                </TableCell>
                <TableCell
                  sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' }}
                >
                  From
                </TableCell>
                <TableCell
                  sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' }}
                >
                  To
                </TableCell>
                <TableCell
                  sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' }}
                >
                  Amount
                </TableCell>
                <TableCell
                  sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' }}
                >
                  Status
                </TableCell>
                <TableCell
                  sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' }}
                >
                  Description
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ledger.map((row) => (
                <TableRow
                  key={row._id}
                  sx={{
                    '&:last-child td, &:last-child th': { border: 0 },
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                  }}
                >
                  <TableCell sx={{ color: 'white' }}>
                    <Box sx={{ width: '100%', mr: 1 }}>
                      {new Date(row.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'white' }}>{row.type}</TableCell>
                  <TableCell sx={{ color: 'white' }}>
                    {getUserName(row.fromUserId)}
                  </TableCell>
                  <TableCell sx={{ color: 'white' }}>
                    {getUserName(row.toUserId)}
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>
                    {(row.amount / 100).toLocaleString('en-IN', {
                      style: 'currency',
                      currency: row.currency,
                    })}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={row.status}
                      color={getStatusColor(row.status) as any}
                    />
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    {row.description || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>
    </Box>
  );
}
