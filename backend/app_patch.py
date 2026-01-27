@app.route('/api/admin/users-no-account-type', methods=['GET'])
def get_users_no_account_type():
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    try:
        users_with_accounts = set(doc['user_id'] for doc in accounts_collection.find({}, {'user_id': 1}))
        
        users_with_no_type = []
        for u in users_collection.find({'is_admin': {'$ne': True}, '_id': {'$nin': list(users_with_accounts)}}):
            users_with_no_type.append({
                'user_id': str(u['_id']),
                'email': u['email'],
                'name': u.get('name', u['email'].split('@')[0])
            })
        
        return jsonify({
            'success': True,
            'count': len(users_with_no_type),
            'users': users_with_no_type
        })
    except Exception as e:
        logger.error(f"Error fetching users with no account type: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
