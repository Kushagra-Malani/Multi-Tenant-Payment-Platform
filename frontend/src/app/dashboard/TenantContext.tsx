'use client';

import React, { createContext, useContext } from 'react';

export interface TenantContextType {
  selectedTenant: string;
  setSelectedTenant: (tenant: string) => void;
}

export const TenantContext = createContext<TenantContextType>({
  selectedTenant: 'bank1',
  setSelectedTenant: () => {},
});

export const useTenant = () => useContext(TenantContext);
