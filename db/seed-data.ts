// Automatically generated from local JSON files

export const seedData: Record<string, string> = {};

seedData['advances.json'] = `[]`;
seedData['attendance.json'] = `[]`;
seedData['branch_categories.json'] = `[]`;
seedData['branch_menu_items.json'] = `[]`;
seedData['branches.json'] = `[{"id":"6bd135a5-8c68-4a94-91f7-cdb1d7d02636","name":"Sree Vaishnaves","address":"Rajiv Gandhi Road","phone":"9080441018","status":"operational"},{"id":"a5e95425-4c07-42c2-b7b5-22dc9a4563bf","name":"Vaishnaves Classic","address":"Talap","phone":"555-0101","status":"maintenance","internalStartTime":"05:00","internalEndTime":"23:00","customerStartTime":"06:00","customerEndTime":"22:00"}]`;
seedData['categories.json'] = `[{"id":"2d4f2f53-27e6-42fc-a4c3-b0fc6cfcebe2","name":"Maintenance","color":"#f87171"},{"id":"bb7621c5-bf43-4a18-8f83-e18e6c7d3cf2","name":"Raw materials","color":"#4ade80"},{"id":"a21094ce-7db6-4443-bf6b-67e42d76378e","name":"Packaging","color":"#fbbf24"},{"id":"1d803d27-775e-49b8-a764-500e5de83669","name":"Gas / fuel","color":"#60a5fa"},{"id":"0f055376-79ba-47f9-8131-b0439ef2a202","name":"Rent","color":"#c084fc"},{"id":"e3abfb6c-bb9e-4e67-83eb-598dcd37d3de","name":"Electricity","color":"#fcd34d"}]`;
seedData['config.json'] = `[{"id":"00000000-0000-0000-0000-000000000001","attendance":false,"payroll":false,"vendors":false,"inventory":false,"menu":true,"reports":false,"pos":true,"posDefaultGstPercent":5}]`;
seedData['daily_tally.json'] = `[]`;
seedData['departments.json'] = `[{"id":"827d0cf0-37cb-4b2a-89a1-7ab3f8cb151b","name":"Kitchen"},{"id":"2fcd1b99-1eb9-408a-b9c1-7a6c6d2d3a33","name":"Service/Floor"},{"id":"9921f0ce-1c5c-41c1-9a7c-fbc598c19ad8","name":"Utility/Others"},{"id":"33ef3bb9-3733-4f9e-bd4f-0ab755ec031a","name":"Accounts/Counter"},{"id":"672e3477-8bb2-43bb-a5a6-7d10f828a2a5","name":"Management"}]`;
seedData['eod.json'] = `[]`;
seedData['expenses.json'] = `[]`;
seedData['inventory.json'] = `[]`;
seedData['menu.json'] = `[]`;
seedData['menu_categories.json'] = `[]`;
seedData['payroll.json'] = `[]`;
seedData['pos_tables.json'] = `[]`;
seedData['pos_orders.json'] = `[]`;
seedData['pos_kots.json'] = `[]`;
seedData['roles.json'] = `[{"id":"26f1c4e7-4952-4467-b847-f273574a7eb8","name":"Owner","departmentIds":["672e3477-8bb2-43bb-a5a6-7d10f828a2a5"]},{"id":"b1a3d906-8dcd-4e94-9fbb-c67d73c7ff80","name":"Manager","departmentIds":["672e3477-8bb2-43bb-a5a6-7d10f828a2a5"]},{"id":"e534f31c-0c15-46f3-8b7c-d68a983b631d","name":"Cook - Main","departmentIds":["827d0cf0-37cb-4b2a-89a1-7ab3f8cb151b"],"isChef":false},{"id":"cf7cfb77-3e1e-450e-b7d1-dc784f107f9c","name":"Waiter","departmentIds":["2fcd1b99-1eb9-408a-b9c1-7a6c6d2d3a33"]},{"id":"a0d8e8b0-8c2e-43f1-b92e-336eb18f4a3e","name":"Helper - Main","departmentIds":["827d0cf0-37cb-4b2a-89a1-7ab3f8cb151b"],"isChef":false},{"id":"3c078b5e-26f5-4682-841f-117578a1c93a","name":"Supervisor - Kitchen","isChef":false,"departmentIds":["827d0cf0-37cb-4b2a-89a1-7ab3f8cb151b"]},{"id":"51e9f134-8b65-4f3d-b9cf-cd0e37803a67","name":"Supervisor - Service/Cleaning","isChef":false,"departmentIds":["2fcd1b99-1eb9-408a-b9c1-7a6c6d2d3a33","9921f0ce-1c5c-41c1-9a7c-fbc598c19ad8"]},{"id":"85a3c9e6-7b2c-4e89-8d81-8cbdfb75f85b","name":"Service Captain","isChef":false,"departmentIds":["2fcd1b99-1eb9-408a-b9c1-7a6c6d2d3a33"]},{"id":"d3f3f20a-e37d-417d-8b01-fb2b87f4c0a5","name":"Cook - Coffee/Tea","isChef":false,"departmentIds":["827d0cf0-37cb-4b2a-89a1-7ab3f8cb151b"]},{"id":"c60f789d-7db1-4e7a-bb4f-1262ab0b59b5","name":"Cook - Poori/Chapathi/Parotta","isChef":false,"departmentIds":["827d0cf0-37cb-4b2a-89a1-7ab3f8cb151b"]},{"id":"82eb91f5-1ab1-4e94-87cf-6e8eb5b36484","name":"Cook - Dosa","isChef":false,"departmentIds":["827d0cf0-37cb-4b2a-89a1-7ab3f8cb151b"]},{"id":"5cb7a32b-31d2-43bb-a53c-1b702eb50e70","name":"Helper - Cutting","isChef":false,"departmentIds":["827d0cf0-37cb-4b2a-89a1-7ab3f8cb151b"]},{"id":"1f0c239d-2eb2-45e3-b9eb-1e90df3a1b3a","name":"Helper - Grinder","isChef":false,"departmentIds":["827d0cf0-37cb-4b2a-89a1-7ab3f8cb151b"]},{"id":"887e2b7e-9cc0-4965-b778-9585cb159491","name":"Cook - Chineese/Tandori","isChef":false,"departmentIds":["827d0cf0-37cb-4b2a-89a1-7ab3f8cb151b"]},{"id":"55ea25fb-d1db-4966-9e67-d86db169d2d0","name":"Helper - Chineese/Tandori","isChef":false,"departmentIds":["827d0cf0-37cb-4b2a-89a1-7ab3f8cb151b"]},{"id":"6eb431a4-96d5-4a6c-974a-1abfbaf746e5","name":"Cleaning","isChef":false,"departmentIds":["827d0cf0-37cb-4b2a-89a1-7ab3f8cb151b","2fcd1b99-1eb9-408a-b9c1-7a6c6d2d3a33"]},{"id":"888d3eb6-81a6-4b89-a2de-8df85eb9372d","name":"Cook - Snacks","isChef":false,"departmentIds":["827d0cf0-37cb-4b2a-89a1-7ab3f8cb151b"]},{"id":"73c2a0d1-039c-4874-9f44-8d4e738c8a14","name":"Security","isChef":false,"departmentIds":["9921f0ce-1c5c-41c1-9a7c-fbc598c19ad8"]},{"id":"7f4d2f80-77a8-4cbb-9c29-38e9c9a01f68","name":"Cashier","isChef":false,"departmentIds":["33ef3bb9-3733-4f9e-bd4f-0ab755ec031a"]},{"id":"5eb98f82-df51-4e78-831e-450f61d2d3e1","name":"Billing","isChef":false,"departmentIds":["33ef3bb9-3733-4f9e-bd4f-0ab755ec031a"]},{"id":"10fa65d9-d8be-419b-ba2d-48d9047b3117","name":"Helper - Parcel/Setting","isChef":false,"departmentIds":["827d0cf0-37cb-4b2a-89a1-7ab3f8cb151b"]}]`;
seedData['staff.json'] = `[]`;
seedData['staff_requirements.json'] = `[]`;
seedData['stock_adjustments.json'] = `[]`;
seedData['users.json'] = `[{"id":"00000000-0000-0000-0000-000000000002","name":"Abhishek","password":"$2b$10$dhprGNq0tklhM.Q90uS0ke82tyLy0EnzW.9hbchzK6.Ii2yqbdMUy","role":"admin","isAdmin":true,"isGlobalOwner":true}]`;
seedData['vendors.json'] = `[]`;
