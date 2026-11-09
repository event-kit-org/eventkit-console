import type { RouteObject } from 'react-router';
import { RequireAuth } from '@/auth/RequireAuth';
import { AppShell } from '@/components/AppShell';
import { CheckpointsPage } from '@/features/admin/CheckpointsPage';
import { CreateEventPage } from '@/features/admin/CreateEventPage';
import { EventStatistics } from '@/features/admin/EventStatistics';
import { FeaturesPage } from '@/features/admin/FeaturesPage';
import { FieldsPage } from '@/features/admin/FieldsPage';
import { AssignmentsPage } from '@/features/admin/AssignmentsPage';
import { LinksPage } from '@/features/admin/LinksPage';
import { PaymentSetupPage } from '@/features/admin/PaymentSetupPage';
import { PaymentsPage } from '@/features/admin/PaymentsPage';
import { PortalConnectionPage } from '@/features/admin/PortalConnectionPage';
import { PeoplePage, StaffPage } from '@/features/admin/PeoplePage';
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
import { LeaderboardsPage } from '@/features/judging/LeaderboardsPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import {
  SubmissionDetailsPage,
  SubmissionPage,
  SubmissionQuestionsPage,
} from '@/features/submissions/SubmissionPage';
import { SubmissionsPage } from '@/features/submissions/SubmissionsPage';
import { PollsPage } from '@/features/polls/PollsPage';
import { EventPeoplePage } from '@/features/scanner/EventPeoplePage';
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
              { path: 'leaderboards', element: <LeaderboardsPage /> },
              {
                element: <RequireRole roles={['admin', 'volunteer']} />,
                children: [
                  { path: 'scan', element: <ScannerPage /> },
                  { path: 'attendees', element: <EventPeoplePage /> },
                ],
              },
              {
                element: <RequireRole roles={['admin', 'reviewer']} />,
                children: [
                  { path: 'statistics', element: <EventStatistics /> },
                  { path: 'teams', element: <TeamsPage /> },
                  { path: 'teams/:teamId', element: <TeamDetailPage /> },
                  { path: 'payments', element: <PaymentsPage /> },
                ],
              },
              {
                element: <RequireRole roles={['admin']} />,
                children: [
                  { path: 'people', element: <PeoplePage /> },
                  { path: 'staff', element: <StaffPage /> },
                  { path: 'links', element: <LinksPage /> },
                  { path: 'form', element: <FieldsPage /> },
                  { path: 'assignments', element: <AssignmentsPage /> },
                  { path: 'submissions', element: <SubmissionsPage /> },
                  { path: 'submissions/:submissionId', element: <SubmissionPage /> },
                  {
                    path: 'submissions/:submissionId/questions',
                    element: <SubmissionQuestionsPage />,
                  },
                  { path: 'submissions/:submissionId/details', element: <SubmissionDetailsPage /> },
                  { path: 'checkpoints', element: <CheckpointsPage /> },
                  { path: 'portal', element: <PortalConnectionPage /> },
                  { path: 'features', element: <FeaturesPage /> },
                  { path: 'payment', element: <PaymentSetupPage /> },
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
