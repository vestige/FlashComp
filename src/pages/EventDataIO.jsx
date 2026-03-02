import { Navigate, useParams } from "react-router-dom";

const EventDataIO = () => {
  const { eventId } = useParams();
  return <Navigate to={`/events/${eventId}/climbers`} replace />;
};

export default EventDataIO;
