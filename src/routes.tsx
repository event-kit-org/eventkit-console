import type { RouteObject } from 'react-router';
import { RequireAuth } from '@/auth/RequireAuth';
import { AppShell } from '@/components/AppShell';
import { CheckpointsPage } from '@/features/admin/CheckpointsPage';
import { CreateEventPage } from '@/features/admin/CreateEventPage';
import { FieldsPage } from '@/features/admin/FieldsPage';
import { LinksPage } from '@/features/admin/LinksPage';
import { PaymentsPage } from '@/features/admin/PaymentsPage';
import { PeoplePage } from '@/features/admin/PeoplePage';
import { RequireRole } from '@/features/admin/RequireAdmin';
import { SettingsPage } from '@/features/admin/SettingsPage';
import { TeamDetailPage } from '@/features/admin/TeamDetailPage';
import { TeamsPage } from '@/features/admin/TeamsPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { SignupPage } from '@/features/auth/SignupPage';
import { EventHome } from '@/features/events/EventHome';
import { EventLayout } from '@/features/events/EventLayout';
import { EventsPage } from '@/features/events/EventsPage';
import { JudgingPage } from '@/features/judging/JudgingPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { PollsPage } from '@/features/polls/PollsPage';
import { ScannerPage } from '@/features/scanner/ScannerPage';
import { AccountPage } from '@/features/account/AccountPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { NotFoundPage } from '@/NotFoundPage';

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <EventsPage /> },
          { path: 'account', element: <AccountPage /> },
          { path: 'events/new', element: <CreateEventPage /> },
          {
            path: 'events/:eventId',
            element: <EventLayout />,
            children: [
              { index: true, element: <EventHome /> },
              { path: 'polls', element: <PollsPage /> },
              { path: 'notifications', element: <NotificationsPage /> },
              { path: 'judging', element: <JudgingPage /> },
              {
                element: <RequireRole roles={['admin', 'volunteer']} />,
                children: [{ path: 'scan', element: <ScannerPage /> }],
              },
              {
                element: <RequireRole roles={['admin', 'reviewer']} />,
                children: [
                  { path: 'teams', element: <TeamsPage /> },
                  { path: 'teams/:teamId', element: <TeamDetailPage /> },
                  { path: 'payments', element: <PaymentsPage /> },
                ],
              },
              {
                element: <RequireRole roles={['admin']} />,
                children: [
                  { path: 'people', element: <PeoplePage /> },
                  { path: 'links', element: <LinksPage /> },
                  { path: 'form', element: <FieldsPage /> },
                  { path: 'checkpoints', element: <CheckpointsPage /> },
                  { path: 'settings', element: <SettingsPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];
