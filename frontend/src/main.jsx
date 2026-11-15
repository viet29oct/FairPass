import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { MotionConfig } from "motion/react";
import { config as faConfig } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { WalletProvider } from "./hooks/useWallet";
import { ToastProvider } from "./components/ui/Toast";
import { router } from "./router";
import "./index.css";

faConfig.autoAddCss = false; // đã import styles.css ở trên

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* reducedMotion="user": tôn trọng prefers-reduced-motion cho mọi animation của motion */}
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <WalletProvider>
          <RouterProvider router={router} />
        </WalletProvider>
      </ToastProvider>
    </MotionConfig>
  </StrictMode>
);
