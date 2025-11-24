export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        // Generate token with dummy data
        // const token = jwt.sign(
        //     { id: "test-hospital-id" },
        //     process.env.JWT_SECRET,
        //     { expiresIn: "2d" }
        // );

        res.json({
            // token,
            hospital: {
                id: "test-hospital-id",
                name: "Test Hospital",
                email: email
            }
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};