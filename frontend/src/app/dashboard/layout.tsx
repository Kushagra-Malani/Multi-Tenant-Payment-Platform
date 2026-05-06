'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Select,
  MenuItem,
  SelectChangeEvent,
  CircularProgress,
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { TenantContext } from './TenantContext';
import api from '../../lib/api';

const drawerWidth = 240;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tenantQuery = searchParams.get('tenant');

  const [selectedTenant, setTenantState] = useState<string>('');
  const [tenants, setTenants] = useState<{ slug: string; name: string }[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    let initialTenant = 'bank1';
    const stored = localStorage.getItem('selectedTenant');

    if (tenantQuery) {
      initialTenant = tenantQuery;
    } else if (stored) {
      initialTenant = stored;
    }

    setTenantState(initialTenant);
    if (!tenantQuery) {
      router.replace(`${pathname}?tenant=${initialTenant}`);
    }

    // Fetch live tenants list
    const fetchTenants = async () => {
      try {
        const res = await api.get('/tenants/public');
        setTenants(res.data);
      } catch (error) {
        console.error('Failed to fetch tenants for dropdown:', error);
      }
    };
    fetchTenants();
  }, [tenantQuery, pathname, router]);

  const handleTenantChange = (event: SelectChangeEvent) => {
    const val = event.target.value;
    setTenantState(val);
    localStorage.setItem('selectedTenant', val);
    router.push(`${pathname}?tenant=${val}`);
  };

  const navItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    {
      text: 'Wallets',
      icon: <AccountBalanceWalletIcon />,
      path: '/dashboard/wallets',
    },
    { text: 'Transfer', icon: <SwapHorizIcon />, path: '/dashboard/transfer' },
    { text: 'Ledger', icon: <ReceiptLongIcon />, path: '/dashboard/ledger' },
    {
      text: 'Settlement',
      icon: <AccountBalanceIcon />,
      path: '/dashboard/settlement',
    },
  ];

  if (!isMounted || !selectedTenant) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          bgcolor: '#0f172a',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <TenantContext.Provider
      value={{ selectedTenant, setSelectedTenant: setTenantState }}
    >
      <Box
        sx={{
          display: 'flex',
          minHeight: '100vh',
          bgcolor: '#0f172a',
          color: 'white',
        }}
      >
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              bgcolor: '#1e293b',
              color: 'white',
              borderRight: '1px solid rgba(255,255,255,0.1)',
            },
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography
              variant="h6"
              sx={{ fontWeight: 'bold', mb: 2, textAlign: 'center' }}
            >
              FinanceOps
            </Typography>
            <Typography
              variant="caption"
              sx={{ display: 'block', mb: 1, opacity: 0.7 }}
            >
              ACTIVE TENANT
            </Typography>
            <Select
              value={selectedTenant}
              onChange={handleTenantChange}
              fullWidth
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.05)',
                color: 'white',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255,255,255,0.1)',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255,255,255,0.3)',
                },
                '& .MuiSvgIcon-root': { color: 'white' },
              }}
            >
              {/* Always include platform context for Super Admins */}
              <MenuItem value="platform">Platform Admin</MenuItem>
              {tenants.map((t) => (
                <MenuItem key={t.slug} value={t.slug}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </Box>
          <List>
            {navItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  onClick={() =>
                    router.push(`${item.path}?tenant=${selectedTenant}`)
                  }
                  selected={pathname === item.path}
                  sx={{
                    '&.Mui-selected': { bgcolor: 'rgba(99, 102, 241, 0.2)' },
                    '&.Mui-selected:hover': {
                      bgcolor: 'rgba(99, 102, 241, 0.3)',
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: 'white', minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Drawer>
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          {children}
        </Box>
      </Box>
    </TenantContext.Provider>
  );
}
