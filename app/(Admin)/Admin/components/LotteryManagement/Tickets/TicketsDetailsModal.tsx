"use client";

import {
  OrderDetailsModal as SharedOrderDetailsModal,
  type MutationAction,
  type OrderDetailsModalProps as SharedOrderDetailsModalProps,
  type OrderRecord,
} from "../Orders/OrdersClient";

// Preserve the old import path while keeping one order model and modal owner.
export type {
  OrderRecord,
  PaymentStatus,
  TicketRecord,
  MutationAction,
} from "../Orders/OrdersClient";

export type OrderDetailsModalProps = SharedOrderDetailsModalProps & {
  onMarkPaid?: (order: OrderRecord) => void;
  onIssueMissingTickets?: (order: OrderRecord) => void;
  onEdit?: (order: OrderRecord) => void;
};

/**
 * Displays an already loaded order. This module does not fetch or mutate data.
 * Callbacks open the caller's controlled workflow; the server must independently
 * enforce permissions, recent verification, state checks and transactional audit.
 * Missing callbacks never produce buttons that do nothing.
 */
export default function TicketsDetailsModal(props: OrderDetailsModalProps) {
  const legacyHandlers: Partial<
    Record<MutationAction, (order: OrderRecord) => void>
  > = {
    edit_order: props.onEdit,
    mark_paid: props.onMarkPaid,
    issue_missing_tickets: props.onIssueMissingTickets,
  };
  const availableActions = props.onAction
    ? props.availableActions
    : (Object.keys(legacyHandlers) as MutationAction[]).filter(
        (action) =>
          !!legacyHandlers[action] &&
          (!props.availableActions || props.availableActions.includes(action)),
      );
  const hasActions = !!props.onAction || (availableActions?.length ?? 0) > 0;

  return (
    <SharedOrderDetailsModal
      order={props.order}
      onClose={props.onClose}
      actionsDisabled={props.actionsDisabled}
      availableActions={availableActions}
      onAction={
        hasActions
          ? (action, order) => {
              if (props.onAction) props.onAction(action, order);
              else legacyHandlers[action]?.(order);
            }
          : undefined
      }
    />
  );
}

// Both the default import and a named order-modal import are supported.
export { TicketsDetailsModal as OrderDetailsModal };
