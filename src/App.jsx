import { Suspense, lazy } from "react";
import { BrowserRouter as Router, Navigate, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import ManagementLayout from "./components/ManagementLayout";
import AppShell from "./components/AppShell";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CreateEvent = lazy(() => import("./pages/CreateEvent"));
const EditEvent = lazy(() => import("./pages/EditEvent"));
const SeasonEdit = lazy(() => import("./pages/SeasonEdit"));
const EventClimbers = lazy(() => import("./pages/EventClimbers"));
const EventScores = lazy(() => import("./pages/EventScores"));
const Result = lazy(() => import("./pages/Result"));
const EventRanking = lazy(() => import("./pages/EventRanking"));
const ScoreInput = lazy(() => import("./pages/ScoreInput"));
const EventDataIO = lazy(() => import("./pages/EventDataIO"));
const ScoreSummary = lazy(() => import("./pages/ScoreSummary"));
const ParticipantScoreDetail = lazy(() => import("./pages/ParticipantScoreDetail"));
const SystemAdmin = lazy(() => import("./pages/SystemAdmin"));

const RouteLoadingFallback = () => (
  <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <p className="text-sm text-slate-600">画面を読み込んでいます...</p>
  </div>
);

function App() {
  return (
    <Router basename="/FlashComp">
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <ManagementLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/create-event" element={<CreateEvent />} />
              <Route path="/events/:eventId/edit" element={<EditEvent />} />
              <Route path="/events/:eventId/seasons/:seasonId/edit" element={<SeasonEdit />} />
              <Route path="/events/:eventId/climbers" element={<EventClimbers />} />
              <Route path="/events/:eventId/scores" element={<EventScores />} />
              <Route path="/events/:eventId/result" element={<Result />} />
              <Route path="/events/:eventId/ranking" element={<EventRanking />} />
              <Route
                path="/events/:eventId/scoreinput/:seasonId/:categoryId/:participantId"
                element={<ScoreInput />}
              />
              <Route path="/events/:eventId/data-io" element={<EventDataIO />} />
            </Route>
            <Route
              path="/system-admin"
              element={
                <ProtectedRoute>
                  <SystemAdmin />
                </ProtectedRoute>
              }
            />
            <Route path="/score-summary" element={<ScoreSummary />} />
            <Route
              path="/score-summary/:eventId"
              element={<Navigate to="/?legacy=score-summary-event" replace />}
            />
            <Route path="/score-summary/:eventId/ranking" element={<EventRanking />} />
            <Route
              path="/score-summary/:eventId/participants/:participantId"
              element={<ParticipantScoreDetail />}
            />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
