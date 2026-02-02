import { ConvexClient } from 'convex/browser';
import type { FunctionArgs, FunctionReference, UserIdentity } from 'convex/server';

const DEFAULT_ADMIN_KEY =
  '0135d8598650f8f5cb0f30c34ec2e2bb62793bc28717c8eb6fb577996d50be5f4281b59181095065c5d0f86a2c31ddbe9b597ec62b47ded69782cd';

export class ConvexTestingHelper {
  private _nextSubjectId = 0;
  public client: ConvexClient;
  private _adminKey: string;

  constructor(options: { adminKey?: string; backendUrl?: string } = {}) {
    this.client = new ConvexClient(options.backendUrl ?? 'http://127.0.0.1:3210');
    this._adminKey = options.adminKey ?? DEFAULT_ADMIN_KEY;
  }

  newIdentity(args: Partial<Omit<UserIdentity, 'tokenIdentifier'>>): Omit<UserIdentity, 'tokenIdentifier'> {
    const subject = `test subject ${this._nextSubjectId++}`;
    return { ...args, subject, issuer: 'test issuer' };
  }

  async mutation<M extends FunctionReference<'mutation'>>(fn: M, args: FunctionArgs<M>) {
    return this.client.mutation(fn, args);
  }

  async query<Q extends FunctionReference<'query', 'public'>>(fn: Q, args: FunctionArgs<Q>) {
    return this.client.query(fn, args);
  }

  async close() {
    return this.client.close();
  }
}
