import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CreateEvent from "./pages/CreateEvent";
import EditEvent from "./pages/EditEvent";
import ScoreInput from "./pages/ScoreInput";
import ScoreSummary from "./pages/ScoreSummary";
import EventSummary from "./pages/EventSummary"; // インポートを追加
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Router basename="/FlashComp">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-event"
          element={
            <ProtectedRoute>
              <CreateEvent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:eventId/edit"
          element={
            <ProtectedRoute>
              <EditEvent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:eventId/scoreinput/:seasonId/:categoryId/:participantId"
          element={
            <ProtectedRoute>
              <ScoreInput />
            </ProtectedRoute>
          }
        />
        <Route path="/score-summary" element={<ScoreSummary />} />
        {/* 新しいルートを追加 */}
        <Route path="/score-summary/:eventId" element={<EventSummary />} /> 
      </Routes>
    </Router>
  );
}

export default App;
