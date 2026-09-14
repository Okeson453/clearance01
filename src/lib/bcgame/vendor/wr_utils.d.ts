declare const load: Promise<{
  t1: (userAgent: string) => string;
  t2: (random: string, userAgent: string) => string;
}>;
export default load;
