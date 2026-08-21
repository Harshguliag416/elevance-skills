import Footer from "@/Components/Fotter";
import Navbar from "@/Components/Navbar";
import SecurityGate from "@/Components/SecurityGate";
import "@/styles/globals.css";
import "@/i18n/config"; // initialize i18n before any component renders
import type { AppProps } from "next/app";
import { store } from "@/store/store";
import { Provider, useDispatch } from "react-redux";
import { useEffect } from "react";
import { auth } from "@/firebase/firebase";
import { login, logout } from "@/Feature/Userslice";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
export default function App({ Component, pageProps }: AppProps) {
  function AuthListener() {
    const dispatch = useDispatch();
    useEffect(() => {
      const unsubscribe = auth.onAuthStateChanged((authuser) => {
        if (authuser) {
          dispatch(
            login({
              uid: authuser.uid,
              photo: authuser.photoURL,
              name: authuser.displayName,
              email: authuser.email,
              phoneNumber: authuser.phoneNumber,
            })
          );
        } else {
          dispatch(logout());
        }
      });
      return () => unsubscribe();
    }, [dispatch]);
    return null;
  }

  return (
    <Provider store={store}>
      <AuthListener />
      <div className="bg-white">
        <ToastContainer/>
        <SecurityGate>
          <Navbar />
          <Component {...pageProps} />
          <Footer />
        </SecurityGate>
      </div>
    </Provider>
  );
}
