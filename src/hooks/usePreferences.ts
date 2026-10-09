import { useState, useEffect } from 'react';
import { getProfile, saveProfile } from '../db';
import type { UserProfile } from '../types';

export function usePreferences() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial profile
  useEffect(() => {
    async function load() {
      try {
        const p = await getProfile();
        if (p) {
          setProfile(p);
        }
      } catch (err) {
        console.error('Failed to load profile', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  // Update a subset of profile fields
  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      const p = await getProfile();
      const updated = { ...p, ...updates } as UserProfile;
      await saveProfile(updated);
      setProfile(updated);
    } catch (err) {
      console.error('Failed to save profile', err);
    }
  };

  return { profile, isLoading, updateProfile };
}
