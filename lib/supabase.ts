import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl = "https://odypvklkoighmtyszbpe.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keXB2a2xrb2lnaG10eXN6YnBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MzE4OTYsImV4cCI6MjA4OTMwNzg5Nn0.9haQVh0kgD1GfuNaY76stgUiGI460SjgoHqLDyWjBik";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
