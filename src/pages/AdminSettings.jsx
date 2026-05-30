import React from 'react';

const AdminSettings = () => {
  return (
    <>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-6">
        <div>
          <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background">Settings</h2>
          <p className="text-secondary mt-2">Configure your store preferences and account details.</p>
        </div>
        <button className="bg-primary text-on-primary px-6 py-2 rounded flex items-center gap-2 hover:opacity-90 transition-opacity font-label-caps text-label-caps">
          <span className="material-symbols-outlined text-[18px]">save</span>
          SAVE CHANGES
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Profile Settings */}
        <section className="glass-panel p-8 rounded-lg lg:col-span-2">
          <h3 className="font-bold text-lg text-on-background mb-8">Store Profile</h3>
          <form className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative">
                <input className="peer w-full bg-transparent border-0 border-b border-outline-variant/30 focus:border-outline focus:ring-0 px-0 py-3 font-body-md text-on-background placeholder-transparent" id="storeName" placeholder="Store Name" type="text" defaultValue="Luxe Editorial" />
                <label className="absolute left-0 -top-3.5 text-xs font-label-caps text-outline transition-all peer-placeholder-shown:text-body-md peer-placeholder-shown:top-3 peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-primary" htmlFor="storeName">Store Name</label>
              </div>
              <div className="relative">
                <input className="peer w-full bg-transparent border-0 border-b border-outline-variant/30 focus:border-outline focus:ring-0 px-0 py-3 font-body-md text-on-background placeholder-transparent" id="contactEmail" placeholder="Contact Email" type="email" defaultValue="contact@luxe.com" />
                <label className="absolute left-0 -top-3.5 text-xs font-label-caps text-outline transition-all peer-placeholder-shown:text-body-md peer-placeholder-shown:top-3 peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-primary" htmlFor="contactEmail">Contact Email</label>
              </div>
            </div>
            <div className="relative">
              <input className="peer w-full bg-transparent border-0 border-b border-outline-variant/30 focus:border-outline focus:ring-0 px-0 py-3 font-body-md text-on-background placeholder-transparent" id="address" placeholder="Business Address" type="text" defaultValue="123 Fashion Ave, NY 10001" />
              <label className="absolute left-0 -top-3.5 text-xs font-label-caps text-outline transition-all peer-placeholder-shown:text-body-md peer-placeholder-shown:top-3 peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-primary" htmlFor="address">Business Address</label>
            </div>
            <div>
              <label className="block text-xs font-label-caps text-outline mb-2">Store Logo</label>
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-surface-variant rounded-full flex items-center justify-center text-on-surface-variant font-headline-lg">L</div>
                <button type="button" className="text-sm text-primary hover:underline font-label-caps">CHANGE LOGO</button>
              </div>
            </div>
          </form>
        </section>

        {/* System Settings */}
        <section className="glass-panel p-8 rounded-lg flex flex-col gap-8">
          <div>
            <h3 className="font-bold text-lg text-on-background mb-4">Notifications</h3>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="form-checkbox text-primary rounded border-outline-variant bg-transparent focus:ring-primary focus:ring-offset-background" />
                <span className="text-sm text-on-background">Order confirmations</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="form-checkbox text-primary rounded border-outline-variant bg-transparent focus:ring-primary focus:ring-offset-background" />
                <span className="text-sm text-on-background">Low stock alerts</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="form-checkbox text-primary rounded border-outline-variant bg-transparent focus:ring-primary focus:ring-offset-background" />
                <span className="text-sm text-on-background">Daily summary report</span>
              </label>
            </div>
          </div>
          <div>
            <h3 className="font-bold text-lg text-on-background mb-4">Security</h3>
            <button className="text-sm text-error hover:underline font-label-caps">RESET PASSWORD</button>
          </div>
        </section>
      </div>
    </>
  );
};

export default AdminSettings;
