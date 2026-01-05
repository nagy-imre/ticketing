export function canViewTicket(user, ticketRow) {
  if (user.role === "admin") return true;
  if (user.role === "user") return ticketRow.created_by_user_id === user.id;
  // facility/cleaner can view assigned role
  return ticketRow.assigned_role === user.role;
}

export function canEditTicket(user, ticketRow) {
  if (user.role === "admin") return true;
  if (user.role === "user") return ticketRow.created_by_user_id === user.id;
  return ticketRow.assigned_role === user.role;
}

export function canDeleteTicket(user) {
  return user.role === "admin";
}
