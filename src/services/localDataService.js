import { customerAuthService } from './customerAuthService.js';
import { customerProfileService } from './customerProfileService.js';
import { orgAccessService } from './orgAccessService.js';
import { updateStaffProfile } from './staffProfileUpdate.js';

const databaseRequired = (kind) => {
  throw new Error(`${kind} is not saved because a MySQL-backed API is not configured for this action.`);
};

// Compatibility exports for screens being migrated to their service APIs.
// These adapters intentionally have no browser database or seeded fixtures.
export const authStore = {
  requestOtp: () => databaseRequired('OTP login'),
  verifyOtp: () => databaseRequired('OTP login'),
  emailLogin: (email, password) => customerAuthService.login(email, password),
  socialLogin: () => databaseRequired('Social login'),
};

export const profileStore = {
  update: (profile = {}) => Promise.resolve(profile),
  remove: () => customerProfileService.remove(),
};

export const orderStore = {
  list: () => [],
  create: () => databaseRequired('Order creation'),
  updateStatus: () => databaseRequired('Order status update'),
  updateServiceWorkflow: () => databaseRequired('Order fulfillment'),
  syncBackendWorkflow: (order) => order,
  assignPartner: () => databaseRequired('Delivery assignment'),
};

export const staffProfileStore = {
  update(profile = {}, authenticatedUser = null) {
    return updateStaffProfile({
      profile,
      authenticatedUser,
      changePassword: (request) => orgAccessService.changePassword(request),
      updateMyName: (name) => orgAccessService.updateMyName(name),
    });
  },
};

export const staffAuthStore = {
  async authenticate(username, password, requestedRole) {
    const result = await orgAccessService.login(username, password);
    if (requestedRole && result.user.role !== requestedRole) throw new Error('This account cannot access the selected portal.');
    return { user: result.user, token: result.token };
  },
};

export const collectionStore = {
  list: () => [],
  add: () => databaseRequired('Record creation'),
  update: () => databaseRequired('Record update'),
  // Cache-shaped compatibility calls are intentionally in-memory no-ops;
  // callers must already have completed the authoritative API request.
  upsert: (_name, record) => record,
  remove: () => databaseRequired('Record deletion'),
  replace: (_name, records) => records,
};

export const subscribeToLocalData = () => () => {};

export const notificationStore = {
  list: () => [],
  add: () => databaseRequired('Notification creation'),
  update: () => databaseRequired('Notification update'),
  markRead: () => databaseRequired('Notification update'),
  remove: () => databaseRequired('Notification deletion'),
  clear: () => databaseRequired('Notification deletion'),
};

export const supportStore = {
  tickets: () => [],
  createTicket: () => databaseRequired('Support ticket creation'),
  messages: () => [],
  sendMessage: () => databaseRequired('Support message creation'),
};

export const loyaltyStore = {
  get: () => ({ points: 0, referralCode: '', vouchers: [], referrals: 0 }),
  redeem: () => databaseRequired('Reward redemption'),
};
