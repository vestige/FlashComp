import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CreateEvent from "./pages/CreateEvent";
import EditEvent from "./pages/EditEvent";
import SeasonEdit from "./pages/SeasonEdit";
import EventClimbers from "./pages/EventClimbers";
import EventScores from "./pages/EventScores";
import ScoreInput from "./pages/ScoreInput";
import EventDataIO from "./pages/EventDataIO";
import ScoreSummary from "./pages/ScoreSummary";
import EventSummary from "./pages/EventSummary"; // インポートを追加
import ParticipantScoreDetail from "./pages/ParticipantScoreDetail";
import SystemAdmin from "./pages/SystemAdmin";
import ProtectedRoute from "./components/ProtectedRoute";
import ManagementLayout from "./components/ManagementLayout";

function App() {
  return (
    <Router basename="/FlashComp">
      <Routes>
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
        {/* 新しいルートを追加 */}
        <Route path="/score-summary/:eventId" element={<EventSummary />} /> 
        <Route
          path="/score-summary/:eventId/participants/:participantId"
          element={<ParticipantScoreDetail />}
        />
      </Routes>
    </Router>
  );
}

export default App;
