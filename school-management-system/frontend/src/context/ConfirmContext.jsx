import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ConfirmContext = createContext(null);

const getDialogCopy = (message) => {
  const text = String(message || 'Are you sure you want to continue?');
  const lower = text.toLowerCase();

  if (lower.includes('publish')) {
    return { title: 'Publish results?', confirmText: 'Publish', variant: 'primary' };
  }

  if (lower.includes('rollback')) {
    return { title: 'Rollback change?', confirmText: 'Rollback', variant: 'warning' };
  }

  if (lower.includes('resolved')) {
    return { title: 'Mark as resolved?', confirmText: 'Mark Resolved', variant: 'primary' };
  }

  if (lower.includes('delete')) {
    return { title: 'Delete item?', confirmText: 'Delete', variant: 'danger' };
  }

  return { title: 'Confirm action?', confirmText: 'Confirm', variant: 'primary' };
};

const variantStyles = {
  danger: {
    iconBg: '#fee2e2',
    iconColor: '#b91c1c',
    buttonBg: '#dc2626',
    buttonBorder: '#dc2626',
  },
  warning: {
    iconBg: '#fef3c7',
    iconColor: '#b45309',
    buttonBg: '#d97706',
    buttonBorder: '#d97706',
  },
  primary: {
    iconBg: '#dbeafe',
    iconColor: '#1d4ed8',
    buttonBg: '#2563eb',
    buttonBorder: '#2563eb',
  },
};

export const ConfirmProvider = ({ children }) => {
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback((options) => {
    const message = typeof options === 'string' ? options : options?.message;
    const copy = getDialogCopy(message);

    return new Promise((resolve) => {
      setDialog({
        ...copy,
        ...(typeof options === 'object' ? options : {}),
        message,
        resolve,
      });
    });
  }, []);

  const close = useCallback((result) => {
    setDialog((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);
  const styles = variantStyles[dialog?.variant || 'primary'];

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {dialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(15, 23, 42, 0.5)',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            style={{
              width: '100%',
              maxWidth: 430,
              borderRadius: 14,
              background: '#fff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 18px 45px rgba(2, 6, 23, 0.22)',
              padding: 20,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: styles.iconBg,
                color: styles.iconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 800,
                marginBottom: 12,
              }}
            >
              !
            </div>
            <h3 id="confirm-dialog-title" style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>
              {dialog.title}
            </h3>
            <p style={{ margin: '8px 0 0', color: '#475569', lineHeight: 1.5 }}>
              {dialog.message || 'Are you sure you want to continue?'}
            </p>
            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => close(false)}
                style={{
                  minWidth: 90,
                  padding: '11px 13px',
                  border: '1px solid #d1d5db',
                  borderRadius: 10,
                  background: '#fff',
                  color: '#334155',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                style={{
                  minWidth: 100,
                  padding: '11px 13px',
                  border: `1px solid ${styles.buttonBorder}`,
                  borderRadius: 10,
                  background: styles.buttonBg,
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return context.confirm;
};
