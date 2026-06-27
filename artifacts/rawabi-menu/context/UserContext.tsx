import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export interface UserProfile {
  name: string;
  phone: string;
  address: string;
  lat?: number;
  lng?: number;
}

interface UserContextType {
  user: UserProfile | null;
  isLoading: boolean;
  saveUser: (profile: UserProfile) => Promise<void>;
  clearUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  isLoading: true,
  saveUser: async () => {},
  clearUser: async () => {},
});

const STORAGE_KEY = "@rawabi_user_profile";

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((json) => {
        if (json) setUser(JSON.parse(json));
      })
      .finally(() => setIsLoading(false));
  }, []);

  const saveUser = async (profile: UserProfile) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setUser(profile);
  };

  const clearUser = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, isLoading, saveUser, clearUser }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
