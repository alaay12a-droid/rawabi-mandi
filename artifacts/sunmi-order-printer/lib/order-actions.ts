import type { Order, OrderAction, TerminalEvent } from './types';

// Assigning a driver can move a pending order to out_for_delivery. That must
// not silently acknowledge the pending-order alarm on this terminal.
export function needsAcceptance(order: Order, actions: OrderAction[], events: TerminalEvent[]): boolean {
  if (order.status === 'pending') return true;
  return order.status === 'out_for_delivery'
    && events.some(event => event.type === 'order' && event.orderId === order.id)
    && !actions.some(action => action.orderId === order.id && ['accepted', 'rejected'].includes(action.kind));
}
