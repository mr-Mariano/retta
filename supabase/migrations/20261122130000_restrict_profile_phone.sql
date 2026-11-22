-- The app now reads phones through the owner- and organizer-scoped RPCs.
revoke select (phone) on public.profiles from authenticated;
