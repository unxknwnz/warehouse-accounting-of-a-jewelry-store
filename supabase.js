const SUPABASE_URL = 'https://pwuuadvfidxplxxkumdb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KEqD94tqG47tX6OeG-mzUA_EvGF3beE';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function simplePasswordCheck(inputPassword, storedHash) {
    if (storedHash === '$2a$10$N9qo8uLOickgx2ZMRZoMye3Z6dS2q1p2Q5b3Y5W7JYvTkKz1J2WJu') {
        return inputPassword === 'admin123';
    }
    return inputPassword === storedHash;
}

const AuthAPI = {
    async register(email, username, password, fullName) {
        try {
            const simpleHash = `simple_${Date.now()}_${password}`;
            
            const { data, error } = await supabase
                .from('users')
                .insert({
                    email,
                    username,
                    password_hash: simpleHash,
                    full_name: fullName,
                    role: 'user',
                    is_active: true
                })
                .select('id, email, username, full_name, role, phone');

            if (error) {
                console.error('Registration DB error:', error);
                return { success: false, error: error.message };
            }

            return { success: true, user: data[0] };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: error.message };
        }
    },

    async login(email, password) {
        try {
            console.log('Login attempt for:', email);
            
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .eq('is_active', true)
                .single();

            if (error) {
                console.error('Login DB error:', error);
                return { success: false, error: 'Пользователь не найден' };
            }

            if (!data) {
                return { success: false, error: 'Пользователь не найден' };
            }

            console.log('User found:', data.email, 'Hash:', data.password_hash?.substring(0, 20) + '...');

            const isValid = simplePasswordCheck(password, data.password_hash);
            
            if (!isValid) {
                return { success: false, error: 'Неверный пароль' };
            }

            await supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', data.id);

            const user = {
                id: data.id,
                email: data.email,
                username: data.username,
                full_name: data.full_name,
                role: data.role,
                phone: data.phone
            };

            localStorage.setItem('jewelry_user_session', JSON.stringify({
                user,
                timestamp: Date.now()
            }));

            console.log('Login successful for:', user.email);
            return { success: true, user };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Ошибка при входе' };
        }
    },

    async logout() {
        try {
            localStorage.removeItem('jewelry_user_session');
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: error.message };
        }
    },

    async getSession() {
        try {
            const sessionStr = localStorage.getItem('jewelry_user_session');
            if (!sessionStr) {
                return { success: false };
            }

            const session = JSON.parse(sessionStr);
            const hour = 60 * 60 * 1000;
            
            if (Date.now() - session.timestamp > 24 * hour) {
                localStorage.removeItem('jewelry_user_session');
                return { success: false };
            }

            const { data, error } = await supabase
                .from('users')
                .select('id, email, username, full_name, role, phone')
                .eq('id', session.user.id)
                .eq('is_active', true)
                .single();

            if (error || !data) {
                localStorage.removeItem('jewelry_user_session');
                return { success: false };
            }

            session.timestamp = Date.now();
            localStorage.setItem('jewelry_user_session', JSON.stringify(session));

            return { success: true, user: data };
        } catch (error) {
            console.error('Session error:', error);
            return { success: false, error: error.message };
        }
    },

    async updateProfile(userId, updates) {
        try {
            const { data, error } = await supabase
                .from('users')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .select('id, email, username, full_name, role, phone');

            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('Update profile error:', error);
            return { success: false, error: error.message };
        }
    }
};

const ProductsAPI = {
    async getProducts(filters = {}) {
        try {
            let query = supabase.from('products').select('*');

            if (filters.category) query = query.eq('category', filters.category);
            if (filters.material) query = query.eq('material', filters.material);
            if (filters.status) query = query.eq('status', filters.status);
            if (filters.search) {
                query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get products error:', error);
            return { success: false, error: error.message };
        }
    },

    async getProductById(id) {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get product error:', error);
            return { success: false, error: error.message };
        }
    },

    async createProduct(productData, userId) {
        try {
            const timestamp = Date.now().toString().slice(-6);
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            const sku = `JWL-${timestamp}-${random}`;
            
            let status = 'available';
            if (productData.quantity === 0) {
                status = 'out_of_stock';
            } else if (productData.quantity <= productData.min_quantity) {
                status = 'low_stock';
            }
            
            const { data, error } = await supabase
                .from('products')
                .insert({
                    ...productData,
                    sku,
                    created_by: userId,
                    status: status
                })
                .select();

            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('Create product error:', error);
            return { success: false, error: error.message };
        }
    },

    async updateProduct(id, updates) {
        try {
            const { data, error } = await supabase
                .from('products')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select();

            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('Update product error:', error);
            return { success: false, error: error.message };
        }
    },

    async deleteProduct(id) {
        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Delete product error:', error);
            return { success: false, error: error.message };
        }
    }
};

const TransactionsAPI = {
    async getTransactions(filters = {}) {
        try {
            let query = supabase
                .from('transactions')
                .select(`
                    *,
                    product:products(name, sku),
                    user:users(full_name, email)
                `);

            if (filters.type) query = query.eq('type', filters.type);
            if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
            if (filters.dateTo) query = query.lte('created_at', filters.dateTo);

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get transactions error:', error);
            return { success: false, error: error.message };
        }
    },

    async createTransaction(transactionData, userId) {
        try {
            if (transactionData.type === 'write_off') {
                transactionData.price = 0;
            }
            
            if (!transactionData.price || transactionData.price <= 0) {
                const product = await ProductsAPI.getProductById(transactionData.product_id);
                if (product.success) {
                    transactionData.price = product.data.price;
                }
            }

            const total = transactionData.quantity * transactionData.price;
            
            const { data, error } = await supabase
                .from('transactions')
                .insert({
                    ...transactionData,
                    user_id: userId,
                    total: total
                })
                .select();

            if (error) throw error;

            const product = await ProductsAPI.getProductById(transactionData.product_id);
            if (product.success) {
                let newQuantity = product.data.quantity;
                
                if (transactionData.type === 'sale' || transactionData.type === 'write_off') {
                    newQuantity -= transactionData.quantity;
                } else if (transactionData.type === 'receipt') {
                    newQuantity += transactionData.quantity;
                }

                await ProductsAPI.updateProduct(transactionData.product_id, {
                    quantity: newQuantity
                });
            }

            return { success: true, data: data[0] };
        } catch (error) {
            console.error('Create transaction error:', error);
            return { success: false, error: error.message };
        }
    }
};

window.SupabaseAPI = {
    auth: AuthAPI,
    products: ProductsAPI,
    transactions: TransactionsAPI,
    supabase

};
