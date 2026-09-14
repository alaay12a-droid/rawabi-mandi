import React, { createContext, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { getPrintedOrderIds, addPrintedOrderId } from './storage';
import { printOrder } from './printer';

export const PrintQueueContext = createContext({});

export const PrintQueueProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: orders } = useQuery({
    queryKey: ['orders'],
    queryFn: api.getOrders,
    refetchInterval: 5000,
    retry: false,
  });

  const isPrinting = useRef(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const processQueue = async () => {
      if (isPrinting.current || !orders) return;

      const printedIds = await getPrintedOrderIds();
      
      const toPrint = orders
        .filter(o => o.status === 'preparing' && !printedIds.includes(o.id))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (toPrint.length === 0) return;

      isPrinting.current = true;
      const order = toPrint[0];

      try {
        const success = await printOrder(order);
        if (success) {
          await addPrintedOrderId(order.id);
          isPrinting.current = false;
          timeoutId = setTimeout(processQueue, 1000);
        } else {
          timeoutId = setTimeout(() => {
            isPrinting.current = false;
            processQueue();
          }, 30000);
        }
      } catch (e) {
        timeoutId = setTimeout(() => {
          isPrinting.current = false;
          processQueue();
        }, 30000);
      }
    };

    processQueue();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [orders]);

  return <PrintQueueContext.Provider value={{}}>{children}</PrintQueueContext.Provider>;
};
