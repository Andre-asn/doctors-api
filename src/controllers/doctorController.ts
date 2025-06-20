import { Request, Response } from 'express';
import { supabase } from '../utils/supabase';
import { IGetUserAuthInfoRequest } from '../types/express/IGetUserAuthInfoRequest';
import bcrypt from 'bcryptjs';

export const getDoctors = async (_req: Request, res: Response): Promise<void> => {
    try {
        console.log('Fetching doctors from database...');

        const { data: doctors, error } = await supabase
            .from('doctors')
            .select(`
                *,
                users:user_id (
                    first_name,
                    last_name,
                    email,
                    gender,
                    dob
                ),
                doctor_addresses (
                    address,
                    city,
                    state,
                    country,
                    postal_code
                )
            `);

        if (error) {
            console.error('Database error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching doctors from database'
            });
            return;
        }

        // Transform the data to match our API response format
        const formattedDoctors = doctors.map(doctor => ({
            doctorId: doctor.doctor_id,
            userId: doctor.user_id,
            specialization: doctor.specialization,
            licenseNumber: doctor.license_number,
            yearsOfExperience: doctor.years_of_experience,
            institution: doctor.institution,
            degree: doctor.degree,
            yearsOfEducation: doctor.years_of_education,
            status: doctor.status,
            createdAt: doctor.created_at,
            updatedAt: doctor.updated_at,
            firstName: doctor.users?.first_name,
            lastName: doctor.users?.last_name,
            email: doctor.users?.email,
            gender: doctor.users?.gender,
            dob: doctor.users?.dob,
            address: doctor.doctor_addresses?.address,
            city: doctor.doctor_addresses?.city,
            state: doctor.doctor_addresses?.state,
            country: doctor.doctor_addresses?.country,
            postalCode: doctor.doctor_addresses?.postal_code,
        }));

        res.json({
            success: true,
            message: 'Doctors fetched successfully',
            count: formattedDoctors.length,
            data: formattedDoctors
        });
        console.log(`Successfully fetched ${formattedDoctors.length} doctors`);

    } catch (error) {
        console.error('Error in getDoctors:', error);
        res.status(500).json({
            success: false,
            message: 'Please try again later'
        });
        return;
    }
};

export const getDoctorById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        console.log(`Looking for doctor with ID: ${id}`);

        const { data: doctor, error } = await supabase
            .from('doctors')
            .select(`
                *,
                users:user_id (
                    first_name,
                    last_name,
                    email,
                    gender,
                    dob,
                    status
                ),
                doctor_addresses (
                    address,
                    city,
                    state,
                    country,
                    postal_code
                )
            `)
            .eq('doctor_id', id)
            .single();

        if (error) {
            console.error('Database error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching doctor from database, does that doctor exist?'
            });
            return;
        }

        // Transform the data to match our API response format
        const formattedDoctor = {
            doctorId: doctor.doctor_id,
            userId: doctor.user_id,
            specialization: doctor.specialization,
            licenseNumber: doctor.license_number,
            yearsOfExperience: doctor.years_of_experience,
            institution: doctor.institution,
            degree: doctor.degree,
            yearsOfEducation: doctor.years_of_education,
            status: doctor.users?.status,
            createdAt: doctor.created_at,
            updatedAt: doctor.updated_at,
            firstName: doctor.users?.first_name,
            lastName: doctor.users?.last_name,
            email: doctor.users?.email,
            gender: doctor.users?.gender,
            dob: doctor.users?.dob,
            address: doctor.doctor_addresses?.address,
            city: doctor.doctor_addresses?.city,
            state: doctor.doctor_addresses?.state,
            country: doctor.doctor_addresses?.country,
            postalCode: doctor.doctor_addresses?.postal_code,
        };

        console.log(`Found doctor: ${formattedDoctor.firstName} ${formattedDoctor.lastName}`);
        res.json({
            success: true,
            message: `Found Dr. ${formattedDoctor.firstName} ${formattedDoctor.lastName}`,
            data: formattedDoctor
        });

    } catch (error) {
        console.error(`Error fetching doctor with ID ${req.params.id}:`, error);
        res.status(500).json({
            success: false,
            message: 'Please try again later'
        });
    }
};

export const createDoctor = async (req: IGetUserAuthInfoRequest, res: Response): Promise<void> => {
    try {
        const {
            specialization,
            licenseNumber,
            yearsOfExperience,
            institution,
            degree,
            yearsOfEducation,
            address
        } = req.body;

        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        // Before updating or inserting a user as a doctor, fetch the doctor role_id:
        const { data: doctorRole } = await supabase
            .from('roles')
            .select('id')
            .eq('name', 'doctor')
            .single();
        if (!doctorRole) {
            res.status(500).json({ success: false, message: 'Doctor role not found' });
            return;
        }

        // First, create the doctor record
        const { data: doctor, error: doctorError } = await supabase
            .from('doctors')
            .insert([{
                user_id: userId,
                specialization,
                license_number: licenseNumber,
                years_of_exp: yearsOfExperience,
                institution,
                degree,
                years_of_edu: yearsOfEducation,
            }])
            .select()
            .single();
        
        if (doctorError) {
            res.status(500).json({
                success: false,
                message: 'Error creating doctor record',
                error: doctorError.message
            });
            return;
        }

        // Update the user's role to 'doctor'
        await supabase
            .from('users')
            .update({ role_id: doctorRole.id })
            .eq('id', userId);

        // If address is provided, create the address record
        if (address) {
            const { error: addressError } = await supabase
                .from('doctor_addresses')
                .insert([{
                    doctor_id: doctor.doctor_id,
                    address: address.address,
                    city: address.city,
                    state: address.state,
                    country: address.country,
                    postal_code: address.postalCode
                }]);

            if (addressError) {
                // Note: We don't return here, as the doctor was created successfully
            }
        }

        // Create initial approval record
        await supabase
            .from('approvals')
            .insert([{
                doctor_id: doctor.doctor_id,
            }]);

        // Fetch the complete doctor record with all relations
        const { error: fetchError } = await supabase
            .from('doctors')
            .select(`
                *,
                users:user_id (
                    first_name,
                    last_name,
                    email,
                    gender,
                    dob,
                    status
                ),
                doctor_addresses (
                    address,
                    city,
                    state,
                    country,
                    postal_code
                )
            `)
            .eq('doctor_id', doctor.doctor_id)
            .single();

        if (fetchError) {
            res.status(500).json({
                success: false,
                message: 'Doctor created but error fetching complete record',
                error: fetchError.message
            });
            return;
        }

        // Transform the data to match our API response format
        const formattedDoctor = {
            doctorId: doctor.doctor_id,
            userId: doctor.user_id,
            specialization: doctor.specialization,
            licenseNumber: doctor.license_number,
            yearsOfExperience: doctor.years_of_experience,
            institution: doctor.institution,
            degree: doctor.degree,
            yearsOfEducation: doctor.years_of_education,
            status: doctor.users?.status,
            createdAt: doctor.created_at,
            updatedAt: doctor.updated_at,
            firstName: doctor.users?.first_name,
            lastName: doctor.users?.last_name,
            email: doctor.users?.email,
            gender: doctor.users?.gender,
            dob: doctor.users?.dob,
            address: doctor.doctor_addresses?.address,
            city: doctor.doctor_addresses?.city,
            state: doctor.doctor_addresses?.state,
            country: doctor.doctor_addresses?.country,
            postalCode: doctor.doctor_addresses?.postal_code,
        };

        res.status(201).json({
            success: true,
            message: 'Doctor profile created and user upgraded to doctor',
            data: formattedDoctor
        });

    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error creating doctor',
            error: error.message
        });
    }
};

export const onboardDoctor = async (req: Request, res: Response): Promise<void> => {
    const {
        email,
        password,
        firstName,
        lastName,
        gender,
        dob,
        doctorProfile
    } = req.body;

    // Before inserting a user as a doctor, fetch the doctor role_id:
    const { data: doctorRole } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'doctor')
        .single();
    if (!doctorRole) {
        res.status(500).json({ success: false, message: 'Doctor role not found' });
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Use doctorRole.id as role_id in the insert
    const { data: user, error: userError } = await supabase
        .from('users')
        .insert([{
            email,
            password: hashedPassword,
            first_name: firstName,
            last_name: lastName,
            gender,
            dob,
            role_id: doctorRole.id
        }])
        .select()
        .single();

    if (userError) {
        console.error('Error in creating user:', userError);
        res.status(400).json({ success: false, message: 'User creation failed', error: userError.message });
        return;
    }

    // 2. Create doctor profile (exclude address fields)
    const { address, ...doctorFields } = doctorProfile;
    const { data: doctor, error: doctorError } = await supabase
        .from('doctors')
        .insert([{
            ...doctorFields,
            user_id: user.id
        }])
        .select()
        .single();

    if (doctorError) {
        // Optionally: delete the user you just created to keep data clean
        await supabase.from('users').delete().eq('id', user.id);
        console.error('Error in creating doctor profile:', doctorError);
        res.status(400).json({ success: false, message: 'Doctor profile creation failed', error: doctorError.message });
        return;
    }

    // 3. Create doctor address if present
    let createdAddress = null;
    if (address) {
        const { data: addressData, error: addressError } = await supabase
            .from('doctor_addresses')
            .insert([{
                doctor_id: doctor.doctor_id,
                address: address.address,
                city: address.city,
                state: address.state,
                country: address.country,
                postal_code: address.postalCode
            }])
            .select()
            .single();
        if (addressError) {
            console.error('Error in adding address:', addressError);
            createdAddress = null;
        } else {
            createdAddress = addressData;
        }
    }

    // 4. Create initial approval record for the new doctor
    let approval = null;
    const { data: approvalData, error: approvalError } = await supabase
        .from('approvals')
        .insert([{
            doctor_id: doctor.doctor_id
        }])
        .select()
        .single();
    if (approvalError) {
        console.error('Error creating approval record:', approvalError);
    } else {
        approval = approvalData;
    }

    res.status(201).json({ success: true, user: {...user, password: undefined}, doctor, address: createdAddress, approval });
};

export const deactivateDoctor = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const { data: doctor, error: doctorError } = await supabase
            .from('doctors')
            .select('user_id')
            .eq('doctor_id', id)
            .single();

        if (doctorError || !doctor) {
            res.status(404).json({ 
                success: false, 
                message: 'Doctor not found', 
                error: doctorError?.message 
            });
            return;
        }

        const { error: updateError } = await supabase
            .from('users')
            .update({ status: 'inactive' })
            .eq('id', doctor.user_id);

        if (updateError) {
            res.status(500).json({ 
                success: false, 
                message: 'Error deactivating doctor', 
                error: updateError.message 
            });
            return;
        }

        res.json({ 
            success: true, 
            message: `Doctor ${id} has been deactivated.` 
        });
    } catch (err: any) {
        res.status(500).json({ 
            success: false, 
            message: 'Error deactivating doctor', 
            error: err.message 
        });
    }
};

