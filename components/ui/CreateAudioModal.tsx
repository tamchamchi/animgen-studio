// src/components/ui/Modal.tsx
import { FC, ReactNode } from 'react';
import ReactDOM from 'react-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
}

const Modal: FC<ModalProps> = ({ isOpen, children }) => {
    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm p-4">
            <div className="relative" onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>,
        document.body
    );
};

export default Modal;