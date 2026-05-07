'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

/**
 * Multi-Tenant Login Page
 *
 * Auto-detects the tenant from the subdomain and handles authentication.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenant, setTenant] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Detect tenant from subdomain or query param on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tenantParam = urlParams.get('tenant');

      if (tenantParam) {
        setTenant(tenantParam);
        return;
      }

      const hostname = window.location.hostname;
      const parts = hostname.split('.');

      if (parts.length > 1 && parts[0] !== 'www' && parts[0] !== 'localhost') {
        setTenant(parts[0]);
      } else {
        // Fallback for local dev without subdomains or root domain access
        // Defaults to 'platform' to allow super admin login on financeops.com
        setTenant('platform');
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.post(
        '/auth/login',
        {
          email,
          password,
          tenantId: tenant, // Middleware resolves this, but we send it for safety
        },
      );

      // Save refresh token and user info to localStorage
      if (response.data.refreshToken) {
        localStorage.setItem('refreshToken', response.data.refreshToken);
      }
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      // Save tenantId for the axios interceptor
      localStorage.setItem('tenantId', tenant || 'platform');

      // Set client-readable cookie for middleware
      document.cookie = `isAuthenticated=true; path=/; max-age=${15 * 60}; SameSite=Lax`;

      router.push(`/dashboard?tenant=${tenant || 'platform'}`);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(
        err.response?.data?.message ||
          'Login failed. Please check your credentials and tenant context.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        py: 4,
      }}
    >
      <Container maxWidth="xs">
        <Paper
          elevation={24}
          sx={{
            p: 4,
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'white',
          }}
        >
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography
              variant="h4"
              gutterBottom
              sx={{ fontWeight: 800, letterSpacing: -1 }}
            >
              {tenant ? tenant.toUpperCase() : 'PLATFORM'}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              Secure Payment Gateway Access
            </Typography>
          </Box>

          <Divider sx={{ mb: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email Address"
              variant="outlined"
              margin="normal"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              sx={textFieldStyles}
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              variant="outlined"
              margin="normal"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              sx={textFieldStyles}
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                mt: 4,
                py: 1.5,
                borderRadius: 2,
                fontWeight: 'bold',
                textTransform: 'none',
                fontSize: '1rem',
                background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)',
                '&:hover': {
                  opacity: 0.9,
                },
              }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ opacity: 0.5 }}>
              By logging in, you agree to the institution&apos;s security
              policies.
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

const textFieldStyles = {
  '& .MuiOutlinedInput-root': {
    color: 'white',
    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.4)' },
    '&.Mui-focused fieldset': { borderColor: '#818cf8' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.5)' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#818cf8' },
};
